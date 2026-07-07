import { useMemo, useState } from 'react'
import type { Round } from '../types'
import { isMatchplay } from '../types'
import { getActiveRoundId, getCourses, getPlayers, getRounds, setActiveRoundId, upsertRound } from '../storage'
import RoundSetupPage from './RoundSetupPage'
import RoundPlayPage from './RoundPlayPage'
import ResultsTable from '../components/ResultsTable'
import MatchplayStatus from '../components/MatchplayStatus'

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
    return (
      <div className="page">
        <h2>Ergebnis: {course.name}</h2>
        {isMatchplay(finished.gameMode) ? (
          <MatchplayStatus course={course} round={finished} players={players} showThru={false} />
        ) : (
          <ResultsTable course={course} round={finished} players={players} showThru={false} />
        )}
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
