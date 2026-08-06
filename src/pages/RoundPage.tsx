import { useEffect, useMemo, useState } from 'react'
import type { Player, Round } from '../types'
import { isMatchplay } from '../types'
import { getActiveRoundId, getPlayers, getRounds, setActiveRoundId, upsertRound } from '../storage'
import { useCourses } from '../lib/CoursesContext'
import { fetchPlayers } from '../lib/liveRound'
import RoundSetupPage from './RoundSetupPage'
import RoundPlayPage from './RoundPlayPage'
import LiveRoundLobbyPage from './LiveRoundLobbyPage'
import LiveRoundPlayPage from './LiveRoundPlayPage'
import JoinLiveRoundPage from './JoinLiveRoundPage'
import ResultsTable from '../components/ResultsTable'
import MatchplayStatus from '../components/MatchplayStatus'
import { useTranslation } from '../i18n'

export default function RoundPage() {
  const { t } = useTranslation()
  const { courses } = useCourses()
  const players = getPlayers()

  const [round, setRound] = useState<Round | null>(() => {
    const activeId = getActiveRoundId()
    if (!activeId) return null
    return getRounds().find((r) => r.id === activeId) ?? null
  })
  const [finished, setFinished] = useState<Round | null>(null)
  const [liveRoundPlayers, setLiveRoundPlayers] = useState<Player[]>([])
  const [joining, setJoining] = useState(false)

  const activeCourseId = round?.courseId ?? finished?.courseId
  const course = useMemo(() => courses.find((c) => c.id === activeCourseId), [courses, activeCourseId])
  const isLive = !!(round ?? finished)?.liveRoundId
  const effectivePlayers = isLive ? liveRoundPlayers : players

  // Nach einem Reload existiert die Live-Runde nur noch als lokal gespeicherter
  // Round, die Spieler-Snapshots (liveRoundPlayers) müssen dann neu geladen werden.
  useEffect(() => {
    if (!round?.liveRoundId || liveRoundPlayers.length > 0) return
    fetchPlayers(round.liveRoundId)
      .then((rows) =>
        setLiveRoundPlayers(
          rows.map((r) => ({
            id: r.player_id,
            firstName: r.first_name,
            lastName: r.last_name,
            handicap: r.handicap,
            gender: r.gender,
          })),
        ),
      )
      .catch((error) => console.error('Spielerliste konnte nicht geladen werden', error))
  }, [round?.liveRoundId, liveRoundPlayers.length])

  function handleStart(newRound: Round, livePlayers?: Player[]) {
    upsertRound(newRound)
    setActiveRoundId(newRound.id)
    setRound(newRound)
    setFinished(null)
    setJoining(false)
    if (livePlayers) setLiveRoundPlayers(livePlayers)
  }

  function handleUpdate(updated: Round) {
    upsertRound(updated)
    setRound(updated)
  }

  function handleClaim(playerId: string) {
    if (!round) return
    handleUpdate({ ...round, claimedPlayerId: playerId })
  }

  function handleFinish() {
    if (!round) return
    if (!confirm(t('round.confirmFinish'))) return
    const finishedRound: Round = { ...round, status: 'finished' }
    upsertRound(finishedRound)
    setActiveRoundId(null)
    setFinished(finishedRound)
    setRound(null)
  }

  if (finished && course) {
    return (
      <div className="page">
        <h2>{t('round.result', { course: course.name })}</h2>
        {isMatchplay(finished.gameMode) ? (
          <MatchplayStatus course={course} round={finished} players={effectivePlayers} showThru={false} />
        ) : (
          <ResultsTable course={course} round={finished} players={effectivePlayers} />
        )}
        <button className="primary" onClick={() => setFinished(null)}>{t('round.newRound')}</button>
      </div>
    )
  }

  if (round && course && isLive && effectivePlayers.length === 0) {
    return <div className="page"><p className="hint">{t('live.loading')}</p></div>
  }

  if (round && course) {
    if (round.liveRoundId && !round.claimedPlayerId) {
      return (
        <LiveRoundLobbyPage round={round} course={course} players={effectivePlayers} onClaim={handleClaim} />
      )
    }
    if (round.liveRoundId && round.claimedPlayerId) {
      return (
        <LiveRoundPlayPage
          round={round}
          course={course}
          players={effectivePlayers}
          onUpdate={handleUpdate}
          onFinish={handleFinish}
        />
      )
    }
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

  if (joining) {
    return (
      <JoinLiveRoundPage
        courses={courses}
        onJoin={(newRound, livePlayers) => handleStart(newRound, livePlayers)}
        onCancel={() => setJoining(false)}
      />
    )
  }

  return (
    <div>
      <RoundSetupPage courses={courses} players={players} onStart={handleStart} />
      <div className="page">
        <button className="secondary" onClick={() => setJoining(true)}>{t('roundSetup.joinLive')}</button>
      </div>
    </div>
  )
}
