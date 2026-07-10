import { useMemo, useState } from 'react'
import type { Course, GameMode, Player, Round, RoundPlayer, RoundTeam } from '../types'
import { isMatchplay, isSinglesMatchplay, isTeamMatchplay } from '../types'
import { genId } from '../storage'

const GAME_MODE_LABELS: Record<GameMode, string> = {
  stableford: 'Stableford',
  strokeplay_gross: 'Brutto-Zählspiel',
  strokeplay_net: 'Netto-Zählspiel',
  matchplay_gross: 'Brutto-Matchplay',
  matchplay_net: 'Netto-Matchplay',
  matchplay_fourball: 'Fourball Bestball',
  matchplay_foursomes: 'Klassischer Vierer',
}

function requiredPlayerCount(mode: GameMode): number | null {
  if (isSinglesMatchplay(mode)) return 2
  if (isTeamMatchplay(mode)) return 4
  return null
}

interface Props {
  courses: Course[]
  players: Player[]
  onStart: (round: Round) => void
}

export default function RoundSetupPage({ courses, players, onStart }: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [selection, setSelection] = useState<RoundPlayer[]>([])
  const [gameMode, setGameMode] = useState<GameMode>('stableford')
  const [teamOverride, setTeamOverride] = useState<Record<string, 0 | 1>>({})
  const [error, setError] = useState('')

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])

  function defaultTeeFor(player: Player): string {
    if (!course) return ''
    const match = course.tees.find((t) => t.gender === player.gender)
    return (match ?? course.tees[0])?.id ?? ''
  }

  function teamIndexOf(playerId: string, idx: number): 0 | 1 {
    return teamOverride[playerId] ?? (idx < 2 ? 0 : 1)
  }

  function toggleTeam(playerId: string, idx: number) {
    setTeamOverride({ ...teamOverride, [playerId]: teamIndexOf(playerId, idx) === 0 ? 1 : 0 })
  }

  function togglePlayer(player: Player) {
    setError('')
    const exists = selection.some((s) => s.playerId === player.id)
    const next = exists
      ? selection.filter((s) => s.playerId !== player.id)
      : selection.length < 4
        ? [...selection, { playerId: player.id, teeId: defaultTeeFor(player) }]
        : null
    if (next === null) {
      setError('Es können maximal 4 Spieler an einer Runde teilnehmen.')
      return
    }
    setSelection(next)
    const required = requiredPlayerCount(gameMode)
    if (required !== null && next.length !== required) {
      setGameMode('stableford')
    }
  }

  function setTee(playerId: string, teeId: string) {
    setSelection(selection.map((s) => (s.playerId === playerId ? { ...s, teeId } : s)))
  }

  function handleStart() {
    if (!course) {
      setError('Bitte einen Platz auswählen.')
      return
    }
    if (selection.length === 0) {
      setError('Bitte mindestens einen Spieler auswählen.')
      return
    }
    if (selection.some((s) => !s.teeId)) {
      setError('Bitte für jeden Spieler einen Abschlag wählen.')
      return
    }
    const required = requiredPlayerCount(gameMode)
    if (required !== null && selection.length !== required) {
      setError(`${GAME_MODE_LABELS[gameMode]} erfordert genau ${required} Spieler.`)
      return
    }

    let teams: [RoundTeam, RoundTeam] | undefined
    if (isTeamMatchplay(gameMode)) {
      const team0 = selection.filter((s, idx) => teamIndexOf(s.playerId, idx) === 0).map((s) => s.playerId)
      const team1 = selection.filter((s, idx) => teamIndexOf(s.playerId, idx) === 1).map((s) => s.playerId)
      if (team0.length !== 2 || team1.length !== 2) {
        setError('Bitte genau 2 Spieler pro Team zuordnen.')
        return
      }
      teams = [{ playerIds: team0 as [string, string] }, { playerIds: team1 as [string, string] }]
    }

    const round: Round = {
      id: genId(),
      courseId: course.id,
      date: new Date().toISOString(),
      players: selection,
      scores: Object.fromEntries(selection.map((s) => [s.playerId, {}])),
      status: 'in_progress',
      currentHole: 1,
      gameMode,
      matchConcessions: isMatchplay(gameMode) ? {} : undefined,
      teams,
      teamScores: gameMode === 'matchplay_foursomes' ? { 0: {}, 1: {} } : undefined,
    }
    onStart(round)
  }

  if (courses.length === 0) {
    return <div className="page"><p className="hint">Bitte zuerst einen Platz unter „Plätze“ anlegen.</p></div>
  }
  if (players.length === 0) {
    return <div className="page"><p className="hint">Bitte zuerst Spieler unter „Spieler“ anlegen.</p></div>
  }

  return (
    <div className="page">
      <h2>Neue Runde</h2>

      <label className="field">
        <span>Platz</span>
        <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSelection([]) }}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <h3>Spieler (max. 4)</h3>
      <ul className="list">
        {players.map((player) => {
          const sel = selection.find((s) => s.playerId === player.id)
          return (
            <li key={player.id} className="list-item">
              <label className="checkbox-row">
                <input type="checkbox" checked={!!sel} onChange={() => togglePlayer(player)} />
                <span>{player.firstName} {player.lastName} (HCP {player.handicap})</span>
              </label>
              {sel && course && (
                <select value={sel.teeId} onChange={(e) => setTee(player.id, e.target.value)}>
                  {course.tees.map((tee) => (
                    <option key={tee.id} value={tee.id}>
                      {tee.name} ({tee.gender === 'M' ? 'Herren' : 'Damen'})
                    </option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>

      <label className="field">
        <span>Spielart</span>
        <select value={gameMode} onChange={(e) => setGameMode(e.target.value as GameMode)}>
          {(Object.keys(GAME_MODE_LABELS) as GameMode[]).map((mode) => {
            const required = requiredPlayerCount(mode)
            return (
              <option key={mode} value={mode} disabled={required !== null && selection.length !== required}>
                {GAME_MODE_LABELS[mode]}
              </option>
            )
          })}
        </select>
        <span className="muted">Einzel-Matchplay benötigt genau 2, Team-Matchplay (Vierer/Fourball) genau 4 Spieler.</span>
      </label>

      {isTeamMatchplay(gameMode) && selection.length === 4 && (
        <label className="field">
          <span>Teams</span>
          <div className="stack">
            {selection.map((s, idx) => {
              const player = players.find((p) => p.id === s.playerId)!
              const team = teamIndexOf(s.playerId, idx)
              return (
                <div className="team-assign-row" key={s.playerId}>
                  <span className="entry-name">{player.firstName} {player.lastName}</span>
                  <button type="button" className="secondary" onClick={() => toggleTeam(s.playerId, idx)}>
                    Team {team + 1}
                  </button>
                </div>
              )
            })}
          </div>
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <button className="primary" onClick={handleStart}>Runde starten</button>
    </div>
  )
}
