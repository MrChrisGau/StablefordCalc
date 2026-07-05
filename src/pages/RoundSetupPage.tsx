import { useMemo, useState } from 'react'
import type { Course, Player, Round, RoundPlayer } from '../types'
import { genId } from '../storage'

interface Props {
  courses: Course[]
  players: Player[]
  onStart: (round: Round) => void
}

export default function RoundSetupPage({ courses, players, onStart }: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [selection, setSelection] = useState<RoundPlayer[]>([])
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
    if (exists) {
      setSelection(selection.filter((s) => s.playerId !== player.id))
      return
    }
    if (selection.length >= 4) {
      setError('Es können maximal 4 Spieler an einer Runde teilnehmen.')
      return
    }
    setSelection([...selection, { playerId: player.id, teeId: defaultTeeFor(player) }])
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
    const round: Round = {
      id: genId(),
      courseId: course.id,
      date: new Date().toISOString(),
      players: selection,
      scores: Object.fromEntries(selection.map((s) => [s.playerId, {}])),
      status: 'in_progress',
      currentHole: 1,
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

      {error && <p className="error">{error}</p>}

      <button className="primary" onClick={handleStart}>Runde starten</button>
    </div>
  )
}
