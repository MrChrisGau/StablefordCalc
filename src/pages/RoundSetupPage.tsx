import { useMemo, useState } from 'react'
import type { Course, GameMode, Player, Round, RoundPlayer } from '../types'
import { isMatchplay } from '../types'
import { genId } from '../storage'

const GAME_MODE_LABELS: Record<GameMode, string> = {
  stableford: 'Stableford',
  strokeplay_gross: 'Brutto-Zählspiel',
  strokeplay_net: 'Netto-Zählspiel',
  matchplay_gross: 'Brutto-Matchplay',
  matchplay_net: 'Netto-Matchplay',
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
  const [error, setError] = useState('')

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])

  function defaultTeeFor(player: Player): string {
    if (!course) return ''
    const match = course.tees.find((t) => t.gender === player.gender)
    return (match ?? course.tees[0])?.id ?? ''
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
    if (next.length !== 2 && isMatchplay(gameMode)) {
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
    if (isMatchplay(gameMode) && selection.length !== 2) {
      setError('Matchplay erfordert genau 2 Spieler.')
      return
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
          {(Object.keys(GAME_MODE_LABELS) as GameMode[]).map((mode) => (
            <option key={mode} value={mode} disabled={isMatchplay(mode) && selection.length !== 2}>
              {GAME_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        {selection.length !== 2 && (
          <span className="muted">Matchplay ist nur bei genau 2 Spielern wählbar.</span>
        )}
      </label>

      {error && <p className="error">{error}</p>}

      <button className="primary" onClick={handleStart}>Runde starten</button>
    </div>
  )
}
