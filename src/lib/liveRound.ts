import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Course, GameMode, Player, Round } from '../types'
import { genId } from '../storage'
import { getUserId, supabase } from './supabase'

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

  let roundRow: LiveRoundRow | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 5 && !roundRow; attempt++) {
    const code = randomCode()
    const { data, error } = await supabase
      .from('live_rounds')
      .insert({ code, course_id: course.id, game_mode: round.gameMode, created_by: uid })
      .select()
      .single()
    if (!error) {
      roundRow = data as LiveRoundRow
    } else if (error.code === '23505') {
      lastError = error
      continue // Code bereits vergeben, neu versuchen
    } else {
      throw error
    }
  }
  if (!roundRow) throw lastError ?? new Error('Live-Runde konnte nicht erstellt werden')

  const playerRows = round.players.map((rp) => {
    const player = players.find((p) => p.id === rp.playerId)!
    return {
      live_round_id: roundRow!.id,
      player_id: player.id,
      first_name: player.firstName,
      last_name: player.lastName,
      handicap: player.handicap,
      gender: player.gender,
      tee_id: rp.teeId,
    }
  })
  const { error: playersError } = await supabase.from('live_round_players').insert(playerRows)
  if (playersError) throw playersError

  return { liveRoundId: roundRow.id, code: roundRow.code }
}

export async function fetchPlayers(liveRoundId: string): Promise<LiveRoundPlayerRow[]> {
  const { data, error } = await supabase.from('live_round_players').select('*').eq('live_round_id', liveRoundId)
  if (error) throw error
  return data as LiveRoundPlayerRow[]
}

export async function fetchLiveRoundByCode(
  code: string,
): Promise<{ round: LiveRoundRow; players: LiveRoundPlayerRow[] } | null> {
  const { data: round, error: roundError } = await supabase
    .from('live_rounds')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle()
  if (roundError) throw roundError
  if (!round) return null

  const { data: players, error: playersError } = await supabase
    .from('live_round_players')
    .select('*')
    .eq('live_round_id', round.id)
  if (playersError) throw playersError

  return { round: round as LiveRoundRow, players: (players ?? []) as LiveRoundPlayerRow[] }
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
  const { data, error } = await supabase
    .from('live_round_players')
    .update({ claimed_by: uid, claimed_at: new Date().toISOString() })
    .eq('id', slotId)
    .is('claimed_by', null)
    .select()
  if (error) throw error
  return (data?.length ?? 0) === 1
}

// Best-effort: nur der Ersteller darf per RLS löschen, für alle anderen ein
// stiller No-op (z.B. wenn ein Beitretender abbricht, nicht der Host).
export async function deleteLiveRound(liveRoundId: string): Promise<void> {
  await supabase.from('live_rounds').delete().eq('id', liveRoundId)
}

export async function fetchScores(liveRoundId: string): Promise<LiveRoundScoreRow[]> {
  const { data, error } = await supabase.from('live_round_scores').select('*').eq('live_round_id', liveRoundId)
  if (error) throw error
  return data as LiveRoundScoreRow[]
}

export async function pushScore(
  liveRoundId: string,
  slotId: string,
  holeNumber: number,
  strokes: number | null,
  pickedUp: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('live_round_scores')
    .upsert(
      { live_round_id: liveRoundId, slot_id: slotId, hole_number: holeNumber, strokes, picked_up: pickedUp },
      { onConflict: 'slot_id,hole_number' },
    )
  if (error) throw error
}

export interface LiveRoundHandlers {
  onScoreChange: (payload: RealtimePostgresChangesPayload<LiveRoundScoreRow>) => void
  onPlayerChange: (payload: RealtimePostgresChangesPayload<LiveRoundPlayerRow>) => void
  onRoundChange: (payload: RealtimePostgresChangesPayload<LiveRoundRow>) => void
}

export function subscribeLiveRound(liveRoundId: string, handlers: LiveRoundHandlers): () => void {
  const channel = supabase
    .channel(`live-round-${liveRoundId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_round_scores', filter: `live_round_id=eq.${liveRoundId}` },
      handlers.onScoreChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_round_players', filter: `live_round_id=eq.${liveRoundId}` },
      handlers.onPlayerChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_rounds', filter: `id=eq.${liveRoundId}` },
      handlers.onRoundChange,
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
