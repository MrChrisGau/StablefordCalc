import type { Course, HoleInfo, Tee } from './types'

export function totalPar(course: Course): number {
  return course.holes.reduce((sum, h) => sum + h.par, 0)
}

/** Course Handicap nach WHS-Formel: HCP x (Slope/113) + (CR - Par), gerundet. */
export function courseHandicap(handicapIndex: number, tee: Tee, course: Course): number {
  const raw = handicapIndex * (tee.slope / 113) + (tee.courseRating - totalPar(course))
  return Math.round(raw)
}

/** Vorgabeschläge für eine einzelne Bahn, verteilt über den Bahn-Handicap-Index. */
export function strokesForHole(courseHcp: number, hole: HoleInfo, holeCount: number): number {
  const sign = courseHcp < 0 ? -1 : 1
  const abs = Math.abs(courseHcp)
  const base = Math.floor(abs / holeCount)
  const remainder = abs % holeCount
  const extra = hole.strokeIndex <= remainder ? 1 : 0
  return sign * (base + extra)
}

/** Stableford-Punkte für eine Bahn: 2 minus Abweichung vom Netto-Par, min. 0. */
export function holePoints(gross: number, hole: HoleInfo, strokesReceived: number): number {
  const netPar = hole.par + strokesReceived
  return Math.max(0, 2 - (gross - netPar))
}

export interface HoleResult {
  hole: HoleInfo
  gross: number | undefined
  strokesReceived: number
  points: number | undefined
}

export function computeHoleResults(
  course: Course,
  tee: Tee,
  handicapIndex: number,
  scores: Record<number, number>,
): HoleResult[] {
  const hcp = courseHandicap(handicapIndex, tee, course)
  return course.holes.map((hole) => {
    const strokesReceived = strokesForHole(hcp, hole, course.holeCount)
    const gross = scores[hole.number]
    return {
      hole,
      gross,
      strokesReceived,
      points: gross === undefined ? undefined : holePoints(gross, hole, strokesReceived),
    }
  })
}

export function totalPoints(results: HoleResult[]): number {
  return results.reduce((sum, r) => sum + (r.points ?? 0), 0)
}

export function holesPlayed(results: HoleResult[]): number {
  return results.filter((r) => r.gross !== undefined).length
}
