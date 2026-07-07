import type { Course, HoleInfo, MatchHoleConcession, Tee } from './types'
import { courseHandicap, strokesForHole } from './stableford'

export type StrokeplayVariant = 'gross' | 'net'

export interface StrokeplayHoleResult {
  hole: HoleInfo
  gross: number | undefined
  strokesReceived: number
  diffToPar: number | undefined
}

export function computeStrokeplayResults(
  course: Course,
  tee: Tee,
  handicapIndex: number,
  scores: Record<number, number>,
  variant: StrokeplayVariant,
): StrokeplayHoleResult[] {
  const hcp = courseHandicap(handicapIndex, tee, course)
  return course.holes.map((hole) => {
    const strokesReceived = strokesForHole(hcp, hole, course.holeCount)
    const gross = scores[hole.number]
    const par = variant === 'net' ? hole.par + strokesReceived : hole.par
    return {
      hole,
      gross,
      strokesReceived,
      diffToPar: gross === undefined ? undefined : gross - par,
    }
  })
}

export function totalDiffToPar(results: StrokeplayHoleResult[]): number | undefined {
  const played = results.filter((r) => r.diffToPar !== undefined)
  if (played.length === 0) return undefined
  return played.reduce((sum, r) => sum + (r.diffToPar ?? 0), 0)
}

export function formatDiff(n: number | undefined): string {
  if (n === undefined) return '–'
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

export interface MatchHoleOutcome {
  hole: HoleInfo
  winnerPlayerId: string | 'halved' | undefined
}

interface MatchPlayerInput {
  playerId: string
  tee: Tee
  handicapIndex: number
  scores: Record<number, number>
}

export function computeMatchHoleOutcomes(
  course: Course,
  playerA: MatchPlayerInput,
  playerB: MatchPlayerInput,
  concessions: Record<number, MatchHoleConcession> | undefined,
  variant: StrokeplayVariant,
): MatchHoleOutcome[] {
  const hcpA = courseHandicap(playerA.handicapIndex, playerA.tee, course)
  const hcpB = courseHandicap(playerB.handicapIndex, playerB.tee, course)

  return course.holes.map((hole) => {
    const conceded = concessions?.[hole.number]
    if (conceded) {
      return {
        hole,
        winnerPlayerId: conceded.type === 'halved' ? 'halved' : conceded.playerId,
      }
    }

    const grossA = playerA.scores[hole.number]
    const grossB = playerB.scores[hole.number]
    if (grossA === undefined || grossB === undefined) {
      return { hole, winnerPlayerId: undefined }
    }

    const netA = variant === 'net' ? grossA - strokesForHole(hcpA, hole, course.holeCount) : grossA
    const netB = variant === 'net' ? grossB - strokesForHole(hcpB, hole, course.holeCount) : grossB

    if (netA === netB) return { hole, winnerPlayerId: 'halved' }
    return { hole, winnerPlayerId: netA < netB ? playerA.playerId : playerB.playerId }
  })
}

export interface MatchStatus {
  diff: number // Anzahl Löcher Vorsprung des führenden Spielers, 0 = AS
  leaderId: string | undefined
  holesDecided: number
}

export function matchStatus(outcomes: MatchHoleOutcome[]): MatchStatus {
  const tally: Record<string, number> = {}
  let holesDecided = 0
  for (const o of outcomes) {
    if (o.winnerPlayerId === undefined) continue
    holesDecided++
    if (o.winnerPlayerId === 'halved') continue
    tally[o.winnerPlayerId] = (tally[o.winnerPlayerId] ?? 0) + 1
  }
  const entries = Object.entries(tally)
  if (entries.length === 0) return { diff: 0, leaderId: undefined, holesDecided }
  const [leaderId, leaderWins] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const otherWins = entries.filter(([id]) => id !== leaderId).reduce((sum, [, w]) => sum + w, 0)
  const diff = leaderWins - otherWins
  if (diff === 0) return { diff: 0, leaderId: undefined, holesDecided }
  return { diff, leaderId, holesDecided }
}

export function formatMatchStatus(status: MatchStatus, leaderName: string | undefined): string {
  if (status.diff === 0 || !leaderName) return 'AS'
  return `${leaderName} ${status.diff}Up`
}
