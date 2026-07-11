import type { Course, GameMode, HoleInfo, MatchHoleConcession, Player, Round, Tee } from './types'
import { courseHandicap, effectivePar, strokesForHole } from './stableford'
import type { TFunc } from './i18n'

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
    const par = variant === 'net' ? effectivePar(hole, tee) + strokesReceived : effectivePar(hole, tee)
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

export function formatDiff(n: number | undefined, t: TFunc): string {
  if (n === undefined) return '–'
  if (n === 0) return t('match.even')
  return n > 0 ? `+${n}` : `${n}`
}

export interface MatchHoleOutcome {
  hole: HoleInfo
  winnerSideId: string | 'halved' | undefined
}

export interface MatchSideInput {
  sideId: string
  label: string
  courseHandicap: number
  grossForHole: (holeNumber: number) => number | undefined
}

export function computeMatchHoleOutcomes(
  course: Course,
  sideA: MatchSideInput,
  sideB: MatchSideInput,
  concessions: Record<number, MatchHoleConcession> | undefined,
  variant: StrokeplayVariant,
): MatchHoleOutcome[] {
  return course.holes.map((hole) => {
    const conceded = concessions?.[hole.number]
    if (conceded) {
      return {
        hole,
        winnerSideId: conceded.type === 'halved' ? 'halved' : conceded.sideId,
      }
    }

    const grossA = sideA.grossForHole(hole.number)
    const grossB = sideB.grossForHole(hole.number)
    if (grossA === undefined || grossB === undefined) {
      return { hole, winnerSideId: undefined }
    }

    const netA = variant === 'net' ? grossA - strokesForHole(sideA.courseHandicap, hole, course.holeCount) : grossA
    const netB = variant === 'net' ? grossB - strokesForHole(sideB.courseHandicap, hole, course.holeCount) : grossB

    if (netA === netB) return { hole, winnerSideId: 'halved' }
    return { hole, winnerSideId: netA < netB ? sideA.sideId : sideB.sideId }
  })
}

export interface MatchStatus {
  diff: number // Anzahl Löcher Vorsprung der führenden Seite, 0 = AS
  leaderSideId: string | undefined
  holesDecided: number
}

export function matchStatus(outcomes: MatchHoleOutcome[]): MatchStatus {
  const tally: Record<string, number> = {}
  let holesDecided = 0
  for (const o of outcomes) {
    if (o.winnerSideId === undefined) continue
    holesDecided++
    if (o.winnerSideId === 'halved') continue
    tally[o.winnerSideId] = (tally[o.winnerSideId] ?? 0) + 1
  }
  const entries = Object.entries(tally)
  if (entries.length === 0) return { diff: 0, leaderSideId: undefined, holesDecided }
  const [leaderSideId, leaderWins] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const otherWins = entries.filter(([id]) => id !== leaderSideId).reduce((sum, [, w]) => sum + w, 0)
  const diff = leaderWins - otherWins
  if (diff === 0) return { diff: 0, leaderSideId: undefined, holesDecided }
  return { diff, leaderSideId, holesDecided }
}

export function formatMatchStatus(status: MatchStatus, leaderLabel: string | undefined, t: TFunc): string {
  if (status.diff === 0 || !leaderLabel) return t('match.allSquare')
  return t('match.up', { name: leaderLabel, n: status.diff })
}

export function matchVariant(gameMode: GameMode): StrokeplayVariant {
  return gameMode === 'matchplay_gross' ? 'gross' : 'net'
}

function reduceToThreeQuarters(ch: number): number {
  return Math.round(ch * 0.75)
}

export function buildMatchSides(course: Course, round: Round, players: Player[]): [MatchSideInput, MatchSideInput] | null {
  if (round.gameMode === 'matchplay_fourball' || round.gameMode === 'matchplay_foursomes') {
    if (!round.teams) return null
    const isFourball = round.gameMode === 'matchplay_fourball'

    return round.teams.map((team, teamIndex): MatchSideInput => {
      const teamPlayers = team.playerIds.map((id) => players.find((p) => p.id === id)!)
      const teamRoundPlayers = team.playerIds.map((id) => round.players.find((rp) => rp.playerId === id)!)
      const teamTees = teamRoundPlayers.map((rp) => course.tees.find((t) => t.id === rp.teeId)!)

      const individualHcps = teamPlayers.map((p, i) => courseHandicap(p.handicap, teamTees[i], course))
      const adjustedHcps = isFourball ? individualHcps.map(reduceToThreeQuarters) : individualHcps
      const sideHandicap = Math.round((adjustedHcps[0] + adjustedHcps[1]) / 2)

      const label = `${teamPlayers[0].firstName} & ${teamPlayers[1].firstName}`

      const grossForHole = isFourball
        ? (holeNumber: number) => {
            const [gA, gB] = team.playerIds.map((id) => round.scores[id]?.[holeNumber])
            if (gA === undefined || gB === undefined) return undefined
            return Math.min(gA, gB)
          }
        : (holeNumber: number) => round.teamScores?.[teamIndex]?.[holeNumber]

      return { sideId: `team-${teamIndex}`, label, courseHandicap: sideHandicap, grossForHole }
    }) as [MatchSideInput, MatchSideInput]
  }

  return round.players.slice(0, 2).map((rp): MatchSideInput => {
    const player = players.find((p) => p.id === rp.playerId)!
    const tee = course.tees.find((t) => t.id === rp.teeId)!
    return {
      sideId: player.id,
      label: `${player.firstName} ${player.lastName}`,
      courseHandicap: courseHandicap(player.handicap, tee, course),
      grossForHole: (holeNumber: number) => round.scores[player.id]?.[holeNumber],
    }
  }) as [MatchSideInput, MatchSideInput]
}
