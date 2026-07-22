import type { Course, HoleInfo, Tee } from './types'

/** Par einer Bahn für einen bestimmten Abschlag, inkl. optionalem Override. */
export function effectivePar(hole: HoleInfo, tee: Tee): number {
  return tee.parOverrides?.[hole.number] ?? hole.par
}

export function totalPar(course: Course, tee?: Tee): number {
  return course.holes.reduce((sum, h) => sum + (tee ? effectivePar(h, tee) : h.par), 0)
}

/** Course Handicap nach WHS-Formel: HCP x (Slope/113) + (CR - Par), gerundet. */
export function courseHandicap(handicapIndex: number, tee: Tee, course: Course): number {
  const raw = handicapIndex * (tee.slope / 113) + (tee.courseRating - totalPar(course, tee))
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
export function holePoints(gross: number, par: number, strokesReceived: number): number {
  const netPar = par + strokesReceived
  return Math.max(0, 2 - (gross - netPar))
}

export interface HoleResult {
  hole: HoleInfo
  gross: number | undefined
  strokesReceived: number
  points: number | undefined
  pickedUp: boolean
}

/** Bruttoschläge für ein gestrichenes Loch: Netto-Doppelbogey plus ein Schlag. */
export function pickedUpGross(par: number, strokesReceived: number): number {
  return par + strokesReceived + 3
}

export function computeHoleResults(
  course: Course,
  tee: Tee,
  handicapIndex: number,
  scores: Record<number, number>,
  pickedUp?: Record<number, true>,
): HoleResult[] {
  const hcp = courseHandicap(handicapIndex, tee, course)
  return course.holes.map((hole) => {
    const strokesReceived = strokesForHole(hcp, hole, course.holeCount)
    if (pickedUp?.[hole.number]) {
      const gross = pickedUpGross(effectivePar(hole, tee), strokesReceived)
      return { hole, gross, strokesReceived, points: 0, pickedUp: true }
    }
    const gross = scores[hole.number]
    return {
      hole,
      gross,
      strokesReceived,
      points: gross === undefined ? undefined : holePoints(gross, effectivePar(hole, tee), strokesReceived),
      pickedUp: false,
    }
  })
}

export function totalPoints(results: HoleResult[]): number {
  return results.reduce((sum, r) => sum + (r.points ?? 0), 0)
}

export function holesPlayed(results: HoleResult[]): number {
  return results.filter((r) => r.gross !== undefined).length
}
