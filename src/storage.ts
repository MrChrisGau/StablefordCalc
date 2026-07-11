import type { Course, Player, Round } from './types'

const KEYS = {
  courses: 'stableford:courses',
  players: 'stableford:players',
  rounds: 'stableford:rounds',
  activeRoundId: 'stableford:activeRoundId',
  lang: 'stableford:lang',
} as const

function load<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function genId(): string {
  return crypto.randomUUID()
}

export function getCourses(): Course[] {
  return load<Course[]>(KEYS.courses, [])
}

export function saveCourses(courses: Course[]): void {
  save(KEYS.courses, courses)
}

export function upsertCourse(course: Course): void {
  const courses = getCourses()
  const idx = courses.findIndex((c) => c.id === course.id)
  if (idx >= 0) courses[idx] = course
  else courses.push(course)
  saveCourses(courses)
}

export function deleteCourse(id: string): void {
  saveCourses(getCourses().filter((c) => c.id !== id))
}

export function getPlayers(): Player[] {
  return load<Player[]>(KEYS.players, [])
}

export function savePlayers(players: Player[]): void {
  save(KEYS.players, players)
}

export function upsertPlayer(player: Player): void {
  const players = getPlayers()
  const idx = players.findIndex((p) => p.id === player.id)
  if (idx >= 0) players[idx] = player
  else players.push(player)
  savePlayers(players)
}

export function deletePlayer(id: string): void {
  savePlayers(getPlayers().filter((p) => p.id !== id))
}

export function getRounds(): Round[] {
  return load<Round[]>(KEYS.rounds, []).map((r) => ({ ...r, gameMode: r.gameMode ?? 'stableford' }))
}

export function saveRounds(rounds: Round[]): void {
  save(KEYS.rounds, rounds)
}

export function upsertRound(round: Round): void {
  const rounds = getRounds()
  const idx = rounds.findIndex((r) => r.id === round.id)
  if (idx >= 0) rounds[idx] = round
  else rounds.push(round)
  saveRounds(rounds)
}

export function getActiveRoundId(): string | null {
  return localStorage.getItem(KEYS.activeRoundId)
}

export function setActiveRoundId(id: string | null): void {
  if (id) localStorage.setItem(KEYS.activeRoundId, id)
  else localStorage.removeItem(KEYS.activeRoundId)
}

export function getLang(): string | null {
  return localStorage.getItem(KEYS.lang)
}

export function setLang(lang: string): void {
  localStorage.setItem(KEYS.lang, lang)
}
