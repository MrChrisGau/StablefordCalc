import { useEffect, useRef } from 'react'
import type { Round } from '../types'
import { fetchPlayers, fetchScores, pushScore, subscribeLiveRound, type LiveRoundScoreRow } from './liveRound'

const PUSH_DEBOUNCE_MS = 400

interface SlotInfo {
  ownSlotId: string
  slotToPlayerId: Record<string, string>
}

/**
 * Wrappt onLocalUpdate für Live-Runden: wendet jede Änderung sofort lokal an
 * (unverändertes bestehendes Verhalten), pusht aber nur echte Score-/PickedUp-
 * Änderungen des eigenen Spielers gedämpft an Supabase — reine currentHole-
 * Navigation bleibt rein lokal. Eingehende Realtime-Events für fremde Slots
 * werden gemerged; Echos des eigenen Slots werden ignoriert (das Gerät bleibt
 * für seinen eigenen Slot autoritativ).
 */
export function useLiveRoundSync(round: Round, onLocalUpdate: (round: Round) => void): (updated: Round) => void {
  const roundRef = useRef(round)
  roundRef.current = round
  const onLocalUpdateRef = useRef(onLocalUpdate)
  onLocalUpdateRef.current = onLocalUpdate

  const slotInfoRef = useRef<SlotInfo | null>(null)
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const liveRoundId = round.liveRoundId
  const claimedPlayerId = round.claimedPlayerId

  useEffect(() => {
    if (!liveRoundId || !claimedPlayerId) return
    let cancelled = false
    slotInfoRef.current = null

    function mergeScores(rows: LiveRoundScoreRow[], info: SlotInfo, skipOwnSlot: boolean) {
      const current = roundRef.current
      let scores = current.scores
      let pickedUp = current.pickedUp
      let changed = false
      for (const row of rows) {
        if (skipOwnSlot && row.slot_id === info.ownSlotId) continue
        const playerId = info.slotToPlayerId[row.slot_id]
        if (!playerId) continue
        if (row.strokes !== null) {
          scores = { ...scores, [playerId]: { ...scores[playerId], [row.hole_number]: row.strokes } }
          changed = true
        }
        if (row.picked_up) {
          pickedUp = { ...pickedUp, [playerId]: { ...pickedUp?.[playerId], [row.hole_number]: true } }
          changed = true
        }
      }
      if (changed) onLocalUpdateRef.current({ ...roundRef.current, scores, pickedUp })
    }

    async function init() {
      const playerRows = await fetchPlayers(liveRoundId!)
      if (cancelled) return
      const slotToPlayerId: Record<string, string> = {}
      let ownSlotId = ''
      for (const row of playerRows) {
        slotToPlayerId[row.id] = row.player_id
        if (row.player_id === claimedPlayerId) ownSlotId = row.id
      }
      const info: SlotInfo = { ownSlotId, slotToPlayerId }
      slotInfoRef.current = info

      const scores = await fetchScores(liveRoundId!)
      if (cancelled) return
      mergeScores(scores, info, false)
    }
    init().catch((error) => console.error('Live-Runde konnte nicht initial geladen werden', error))

    const unsubscribe = subscribeLiveRound(liveRoundId, {
      onScoreChange: (payload) => {
        const info = slotInfoRef.current
        if (!info) return
        // Scores werden nie gelöscht (nur per Round-Cascade), daher ist `new` immer die volle Zeile.
        mergeScores([payload.new as LiveRoundScoreRow], info, true)
      },
      onPlayerChange: () => {},
      onRoundChange: () => {},
    })

    return () => {
      cancelled = true
      unsubscribe()
      for (const timer of Object.values(debounceTimers.current)) clearTimeout(timer)
      debounceTimers.current = {}
    }
  }, [liveRoundId, claimedPlayerId])

  function handleUpdate(updated: Round) {
    onLocalUpdate(updated)

    const info = slotInfoRef.current
    if (!liveRoundId || !claimedPlayerId || !info) return

    const prevScores = round.scores[claimedPlayerId] ?? {}
    const nextScores = updated.scores[claimedPlayerId] ?? {}
    const prevPickedUp = round.pickedUp?.[claimedPlayerId] ?? {}
    const nextPickedUp = updated.pickedUp?.[claimedPlayerId] ?? {}

    const changedHoles = new Set<number>()
    for (const key of new Set([...Object.keys(prevScores), ...Object.keys(nextScores)])) {
      const hole = Number(key)
      if (prevScores[hole] !== nextScores[hole]) changedHoles.add(hole)
    }
    for (const key of new Set([...Object.keys(prevPickedUp), ...Object.keys(nextPickedUp)])) {
      const hole = Number(key)
      if (!!prevPickedUp[hole] !== !!nextPickedUp[hole]) changedHoles.add(hole)
    }

    for (const hole of changedHoles) {
      clearTimeout(debounceTimers.current[hole])
      debounceTimers.current[hole] = setTimeout(() => {
        pushScore(liveRoundId, info.ownSlotId, hole, nextScores[hole] ?? null, !!nextPickedUp[hole]).catch((error) =>
          console.error('Score-Synchronisierung fehlgeschlagen', error),
        )
      }, PUSH_DEBOUNCE_MS)
    }
  }

  return round.liveRoundId ? handleUpdate : onLocalUpdate
}
