export type Gender = 'M' | 'W'

export interface Tee {
  id: string
  name: string // z.B. "Weiss", "Gelb", "Rot"
  gender: Gender
  courseRating: number
  slope: number
  parOverrides?: Record<number, number> // Lochnummer -> abweichendes Par für diesen Abschlag
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

export type GameMode =
  | 'stableford'
  | 'strokeplay_gross'
  | 'strokeplay_net'
  | 'matchplay_gross'
  | 'matchplay_net'
  | 'matchplay_fourball'
  | 'matchplay_foursomes'

export type MatchHoleConcession =
  | { type: 'won'; sideId: string } // playerId (Einzel) oder 'team-0'/'team-1' (Team)
  | { type: 'halved' }

export interface RoundTeam {
  playerIds: [string, string]
}

export interface Round {
  id: string
  courseId: string
  date: string // ISO
  players: RoundPlayer[]
  scores: Record<string, Record<number, number>> // playerId -> holeNumber -> Bruttoschläge
  status: 'in_progress' | 'finished'
  currentHole: number
  gameMode: GameMode
  matchConcessions?: Record<number, MatchHoleConcession> // nur bei matchplay_*: holeNumber -> manuell festgelegtes Ergebnis
  teams?: [RoundTeam, RoundTeam] // nur bei matchplay_fourball/foursomes
  teamScores?: Record<number, Record<number, number>> // nur bei matchplay_foursomes: teamIndex -> holeNumber -> Schläge
}

export function isSinglesMatchplay(mode: GameMode): boolean {
  return mode === 'matchplay_gross' || mode === 'matchplay_net'
}

export function isTeamMatchplay(mode: GameMode): boolean {
  return mode === 'matchplay_fourball' || mode === 'matchplay_foursomes'
}

export function isMatchplay(mode: GameMode): boolean {
  return isSinglesMatchplay(mode) || isTeamMatchplay(mode)
}
