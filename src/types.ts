export type Gender = 'M' | 'W'

export interface Tee {
  id: string
  name: string // z.B. "Weiss", "Gelb", "Rot"
  gender: Gender
  courseRating: number
  slope: number
}

export interface HoleInfo {
  number: number // 1..holeCount
  par: number
  strokeIndex: number // Bahn-Handicap, 1..holeCount, jeder Wert einmalig
}

export interface Course {
  id: string
  name: string
  holeCount: 9 | 18
  tees: Tee[]
  holes: HoleInfo[]
}

export interface Player {
  id: string
  firstName: string
  lastName: string
  handicap: number
  gender: Gender
}

export interface RoundPlayer {
  playerId: string
  teeId: string
}

export interface Round {
  id: string
  courseId: string
  date: string // ISO
  players: RoundPlayer[]
  scores: Record<string, Record<number, number>> // playerId -> holeNumber -> Bruttoschläge
  status: 'in_progress' | 'finished'
  currentHole: number
}
