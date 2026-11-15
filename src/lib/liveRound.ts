import { ClientResponseError, type RecordModel } from 'pocketbase'
import type { Course, GameMode, Player, Round } from '../types'
import { genId } from '../storage'
import { ensureAuth, getUserId, pb } from './pocketbase'

export interface LiveRoundRow {
  id: string
  code: string
  course_id: string
  game_mode: GameMode
  status: 'in_progress' | 'finished'
  created_by: string
  created_at: string
}

export interface LiveRoundPlayerRow {
  id: string
  live_round_id: string
  player_id: string
  first_name: string
  last_name: string
  handicap: number
  gender: 'M' | 'W'
  tee_id: string
  claimed_by: string | null
  claimed_at: string | null
}

export interface LiveRoundScoreRow {
  live_round_id: string
  slot_id: string
  hole_number: number
  strokes: number | null
  picked_up: boolean
  updated_at: string
}

function toRoundRow(r: RecordModel): LiveRoundRow {
  return {
    id: r.id,
    code: r.code,
    course_id: r.course_id,
    game_mode: r.game_mode,
    status: r.status || 'in_progress',
    created_by: r.created_by,
    created_at: r.created,
  }
}

function toPlayerRow(r: RecordModel): LiveRoundPlayerRow {
  return {
    id: r.id,
    live_round_id: r.live_round_id,
    player_id: r.player_id,
    first_name: r.first_name,
    last_name: r.last_name,
    handicap: r.handicap,
    gender: r.gender,
    tee_id: r.tee_id,
    claimed_by: r.claimed_by || null,
    claimed_at: r.claimed_at || null,
  }
}

// PocketBase kennt kein NULL für Zahlen: 0 steht für "kein Ergebnis" (Schläge sind immer >= 1).
function toScoreRow(r: RecordModel): LiveRoundScoreRow {
  return {
    live_round_id: r.live_round_id,
    slot_id: r.slot_id,
    hole_number: r.hole_number,
    strokes: r.strokes || null,
    picked_up: !!r.picked_up,
    updated_at: r.updated,
  }
}

function isStatus(error: unknown, ...statuses: number[]): boolean {
  return error instanceof ClientResponseError && statuses.includes(error.status)
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne verwechselbare Zeichen (0/O, 1/I)

function randomCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function createLiveRound(
  round: Round,
  course: Course,
  players: Player[],
): Promise<{ liveRoundId: string; code: string }> {
  const uid = await getUserId()

  let roundRecord: RecordModel | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 5 && !roundRecord; attempt++) {
    try {
      roundRecord = await pb.collection('live_rounds').create({
        code: randomCode(),
        course_id: course.id,
        game_mode: round.gameMode,
        status: 'in_progress',
        created_by: uid,
      })
    } catch (error) {
      // Code bereits vergeben: neu versuchen
      if (isStatus(error, 400) && (error as ClientResponseError).response?.data?.code?.code === 'validation_not_unique') {
        lastError = error
        continue
      }
      throw error
    }
  }
  if (!roundRecord) throw lastError ?? new Error('Live-Runde konnte nicht erstellt werden')

  await Promise.all(
    round.players.map((rp) => {
      const player = players.find((p) => p.id === rp.playerId)!
      return pb.collection('live_round_players').create({
        live_round_id: roundRecord.id,
        player_id: player.id,
        first_name: player.firstName,
        last_name: player.lastName,
        handicap: player.handicap,
        gender: player.gender,
        tee_id: rp.teeId,
      })
    }),
  )

  return { liveRoundId: roundRecord.id, code: roundRecord.code }
}

export async function fetchPlayers(liveRoundId: string): Promise<LiveRoundPlayerRow[]> {
  const records = await pb
    .collection('live_round_players')
    .getFullList({ filter: pb.filter('live_round_id = {:id}', { id: liveRoundId }) })
  return records.map(toPlayerRow)
}

export async function fetchLiveRoundByCode(
  code: string,
): Promise<{ round: LiveRoundRow; players: LiveRoundPlayerRow[] } | null> {
  let record: RecordModel
  try {
    record = await pb.collection('live_rounds').getFirstListItem(pb.filter('code = {:code}', { code: code.toUpperCase() }))
  } catch (error) {
    if (isStatus(error, 404)) return null
    throw error
  }
  const players = await fetchPlayers(record.id)
  return { round: toRoundRow(record), players }
}

export function mapPlayerRowsToPlayers(rows: LiveRoundPlayerRow[]): Player[] {
  return rows.map((r) => ({
    id: r.player_id,
    firstName: r.first_name,
    lastName: r.last_name,
    handicap: r.handicap,
    gender: r.gender,
  }))
}

/** Baut aus einer per Code gefundenen Live-Runde ein lokales Round-Objekt zum Beitreten. */
export function buildRoundFromLiveRound(round: LiveRoundRow, players: LiveRoundPlayerRow[]): Round {
  return {
    id: genId(),
    courseId: round.course_id,
    date: new Date().toISOString(),
    players: players.map((p) => ({ playerId: p.player_id, teeId: p.tee_id })),
    scores: {},
    status: 'in_progress',
    currentHole: 1,
    gameMode: round.game_mode,
    liveRoundId: round.id,
    liveCode: round.code,
  }
}

/** Versucht einen Spieler-Slot zu beanspruchen. Gibt false zurück, wenn ein anderes Gerät schneller war. */
export async function claimSlot(slotId: string): Promise<boolean> {
  const uid = await getUserId()
  try {
    await pb.collection('live_round_players').update(slotId, { claimed_by: uid, claimed_at: new Date().toISOString() })
    return true
  } catch (error) {
    // Die Update-Regel lässt nur freie (oder eigene) Slots zu; sonst antwortet PocketBase mit 404/403.
    if (isStatus(error, 403, 404)) return false
    throw error
  }
}

// Best-effort: nur der Ersteller darf per Regel löschen, für alle anderen ein
// stiller No-op (z.B. wenn ein Beitretender abbricht, nicht der Host).
export async function deleteLiveRound(liveRoundId: string): Promise<void> {
  try {
    await ensureAuth()
    await pb.collection('live_rounds').delete(liveRoundId)
  } catch {
    // bewusst ignoriert
  }
}

export async function fetchScores(liveRoundId: string): Promise<LiveRoundScoreRow[]> {
  const records = await pb
    .collection('live_round_scores')
    .getFullList({ filter: pb.filter('live_round_id = {:id}', { id: liveRoundId }) })
  return records.map(toScoreRow)
}

export async function pushScore(
  liveRoundId: string,
  slotId: string,
  holeNumber: number,
  strokes: number | null,
  pickedUp: boolean,
): Promise<void> {
  await ensureAuth()
  const collection = pb.collection('live_round_scores')
  const fields = { strokes: strokes ?? 0, picked_up: pickedUp }
  const filter = pb.filter('slot_id = {:slot} && hole_number = {:hole}', { slot: slotId, hole: holeNumber })

  async function updateExisting(): Promise<boolean> {
    try {
      const existing = await collection.getFirstListItem(filter)
      await collection.update(existing.id, fields)
      return true
    } catch (error) {
      if (isStatus(error, 404)) return false
      throw error
    }
  }

  if (await updateExisting()) return
  try {
    await collection.create({ live_round_id: liveRoundId, slot_id: slotId, hole_number: holeNumber, ...fields })
  } catch (error) {
    // Parallel angelegt (Unique-Index auf slot_id+hole_number): stattdessen aktualisieren.
    if (isStatus(error, 400) && (await updateExisting())) return
    throw error
  }
}

export interface LiveRoundEvent<T> {
  action: string // create | update | delete
  row: T
}

export interface LiveRoundHandlers {
  onScoreChange: (event: LiveRoundEvent<LiveRoundScoreRow>) => void
  onPlayerChange: (event: LiveRoundEvent<LiveRoundPlayerRow>) => void
  onRoundChange: (event: LiveRoundEvent<LiveRoundRow>) => void
}

export function subscribeLiveRound(liveRoundId: string, handlers: LiveRoundHandlers): () => void {
  const unsubscribes = Promise.all([
    pb.collection('live_round_scores').subscribe(
      '*',
      (e) => handlers.onScoreChange({ action: e.action, row: toScoreRow(e.record) }),
      { filter: pb.filter('live_round_id = {:id}', { id: liveRoundId }) },
    ),
    pb.collection('live_round_players').subscribe(
      '*',
      (e) => handlers.onPlayerChange({ action: e.action, row: toPlayerRow(e.record) }),
      { filter: pb.filter('live_round_id = {:id}', { id: liveRoundId }) },
    ),
    pb.collection('live_rounds').subscribe(liveRoundId, (e) =>
      handlers.onRoundChange({ action: e.action, row: toRoundRow(e.record) }),
    ),
  ]).catch((error) => {
    console.error('Live-Echtzeitverbindung fehlgeschlagen', error)
    return [] as Array<() => Promise<void>>
  })
  return () => {
    unsubscribes.then((fns) => fns.forEach((fn) => fn()))
  }
}
