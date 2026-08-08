import { useEffect, useMemo, useState } from 'react'
import type { Player, Round } from '../types'
import { isMatchplay } from '../types'
import { deleteRound, getActiveRoundId, getPlayers, getRounds, setActiveRoundId, upsertRound } from '../storage'
import { useCourses } from '../lib/CoursesContext'
import { buildRoundFromLiveRound, deleteLiveRound, fetchLiveRoundByCode, fetchPlayers, mapPlayerRowsToPlayers } from '../lib/liveRound'
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
  const { courses, loading: coursesLoading } = useCourses()
  const players = getPlayers()

  const [round, setRound] = useState<Round | null>(() => {
    const activeId = getActiveRoundId()
    if (!activeId) return null
    return getRounds().find((r) => r.id === activeId) ?? null
  })
  const [finished, setFinished] = useState<Round | null>(null)
  const [liveRoundPlayers, setLiveRoundPlayers] = useState<Player[]>([])
  const [joining, setJoining] = useState(false)
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  const [autoJoinError, setAutoJoinError] = useState('')

  const activeCourseId = round?.courseId ?? finished?.courseId
  const course = useMemo(() => courses.find((c) => c.id === activeCourseId), [courses, activeCourseId])
  const isLive = !!(round ?? finished)?.liveRoundId
  const effectivePlayers = isLive ? liveRoundPlayers : players

  // Beitritts-Link (?join=CODE, z.B. aus Teilen/QR-Code) einmalig aus der URL lesen.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('join')
    if (!code) return
    window.history.replaceState(null, '', window.location.pathname)
    setPendingJoinCode(code)
  }, [])

  // Sobald ein Beitritts-Code aussteht und die Platzliste geladen ist (wichtig auf
  // einem brandneuen Gerät ohne lokalen Cache), automatisch der Runde beitreten.
  useEffect(() => {
    if (!pendingJoinCode || round || coursesLoading) return
    let cancelled = false
    setAutoJoinError('')
    fetchLiveRoundByCode(pendingJoinCode)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setAutoJoinError(t('live.joinNotFound'))
          return
        }
        const foundCourse = courses.find((c) => c.id === result.round.course_id)
        if (!foundCourse) {
          setAutoJoinError(t('live.joinNoCourse'))
          return
        }
        handleStart(buildRoundFromLiveRound(result.round, result.players), mapPlayerRowsToPlayers(result.players))
      })
      .catch((error) => {
        console.error('Automatischer Beitritt fehlgeschlagen', error)
        if (!cancelled) setAutoJoinError(t('live.joinError'))
      })
      .finally(() => {
        if (!cancelled) setPendingJoinCode(null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJoinCode, coursesLoading, round])

  // Nach einem Reload existiert die Live-Runde nur noch als lokal gespeicherter
  // Round, die Spieler-Snapshots (liveRoundPlayers) müssen dann neu geladen werden.
  useEffect(() => {
    if (!round?.liveRoundId || liveRoundPlayers.length > 0) return
    fetchPlayers(round.liveRoundId)
      .then((rows) => setLiveRoundPlayers(mapPlayerRowsToPlayers(rows)))
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

  function handleWatch() {
    if (!round) return
    handleUpdate({ ...round, spectating: true })
  }

  function handleCancelLive() {
    if (!round) return
    if (round.liveRoundId) deleteLiveRound(round.liveRoundId).catch((error) => console.error('Live-Runde konnte nicht aufgeräumt werden', error))
    deleteRound(round.id)
    setActiveRoundId(null)
    setRound(null)
    setLiveRoundPlayers([])
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

  if (!round && pendingJoinCode) {
    return (
      <div className="page">
        <p className="hint">{t('live.loading')}</p>
      </div>
    )
  }

  if (round && course && isLive && effectivePlayers.length === 0) {
    return (
      <div className="page">
        <p className="hint">{t('live.loading')}</p>
        <button className="secondary" onClick={handleCancelLive}>{t('common.cancel')}</button>
      </div>
    )
  }

  if (round && course) {
    if (round.liveRoundId && !round.claimedPlayerId && !round.spectating) {
      return (
        <LiveRoundLobbyPage
          round={round}
          course={course}
          players={effectivePlayers}
          onClaim={handleClaim}
          onWatch={handleWatch}
          onCancel={handleCancelLive}
        />
      )
    }
    if (round.liveRoundId && (round.claimedPlayerId || round.spectating)) {
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
        {autoJoinError && <p className="error">{autoJoinError}</p>}
        <button className="secondary" onClick={() => setJoining(true)}>{t('roundSetup.joinLive')}</button>
      </div>
    </div>
  )
}
