import { useMemo, useState } from 'react'
import type { Round } from '../types'
import { getActiveRoundId, getCourses, getPlayers, getRounds, setActiveRoundId, upsertRound } from '../storage'
import RoundSetupPage from './RoundSetupPage'
import RoundPlayPage from './RoundPlayPage'
import { totalPoints, computeHoleResults } from '../stableford'

export default function RoundPage() {
  const courses = getCourses()
  const players = getPlayers()

  const [round, setRound] = useState<Round | null>(() => {
    const activeId = getActiveRoundId()
    if (!activeId) return null
    return getRounds().find((r) => r.id === activeId) ?? null
  })
  const [finished, setFinished] = useState<Round | null>(null)

  const activeCourseId = round?.courseId ?? finished?.courseId
  const course = useMemo(() => courses.find((c) => c.id === activeCourseId), [courses, activeCourseId])

  function handleStart(newRound: Round) {
    upsertRound(newRound)
    setActiveRoundId(newRound.id)
    setRound(newRound)
    setFinished(null)
  }

  function handleUpdate(updated: Round) {
    upsertRound(updated)
    setRound(updated)
  }

  function handleFinish() {
    if (!round) return
    if (!confirm('Runde jetzt abschließen?')) return
    const finishedRound: Round = { ...round, status: 'finished' }
    upsertRound(finishedRound)
    setActiveRoundId(null)
    setFinished(finishedRound)
    setRound(null)
  }

  if (finished && course) {
    const results = finished.players.map((rp) => {
      const player = players.find((p) => p.id === rp.playerId)!
      const tee = course.tees.find((t) => t.id === rp.teeId)!
      const holeResults = computeHoleResults(course, tee, player.handicap, finished.scores[rp.playerId] ?? {})
      return { player, total: totalPoints(holeResults) }
    }).sort((a, b) => b.total - a.total)

    return (
      <div className="page">
        <h2>Ergebnis: {course.name}</h2>
        <table>
          <thead>
            <tr><th>Platz</th><th>Spieler</th><th>Punkte</th></tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.player.id}>
                <td>{i + 1}</td>
                <td>{r.player.firstName} {r.player.lastName}</td>
                <td className="points">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="primary" onClick={() => setFinished(null)}>Neue Runde starten</button>
      </div>
    )
  }

  if (round && course) {
    return (
      <RoundPlayPage
        round={round}
        course={course}
        players={players}
        onUpdate={handleUpdate}
        onFinish={handleFinish}
      />
    )
  }

  return <RoundSetupPage courses={courses} players={players} onStart={handleStart} />
}
