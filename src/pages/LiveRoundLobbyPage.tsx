import { useEffect, useState } from 'react'
import type { Course, Player, Round } from '../types'
import { claimSlot, fetchPlayers, subscribeLiveRound, type LiveRoundPlayerRow } from '../lib/liveRound'
import LiveShareButton from '../components/LiveShareButton'
import { useTranslation } from '../i18n'

interface Props {
  round: Round
  course: Course
  players: Player[]
  onClaim: (playerId: string) => void
  onWatch: () => void
  onCancel: () => void
}

export default function LiveRoundLobbyPage({ round, course, players, onClaim, onWatch, onCancel }: Props) {
  const { t } = useTranslation()
  const [slots, setSlots] = useState<LiveRoundPlayerRow[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!round.liveRoundId) return
    let cancelled = false

    function refresh() {
      fetchPlayers(round.liveRoundId!)
        .then((rows) => {
          if (!cancelled) setSlots(rows)
        })
        .catch((err) => console.error('Spielerliste konnte nicht geladen werden', err))
    }
    refresh()

    const unsubscribe = subscribeLiveRound(round.liveRoundId, {
      onScoreChange: () => {},
      onPlayerChange: refresh,
      onRoundChange: () => {},
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [round.liveRoundId])

  async function handlePick(playerId: string) {
    const slot = slots.find((s) => s.player_id === playerId)
    if (!slot || !round.liveRoundId) return
    setError('')
    setClaiming(playerId)
    try {
      const won = await claimSlot(slot.id)
      if (won) onClaim(playerId)
      else setError(t('live.claimTaken'))
    } catch (err) {
      setError(t('live.claimError'))
      console.error(err)
    } finally {
      setClaiming(null)
    }
  }

  return (
    <div className="page">
      <h2>{t('live.lobbyTitle', { course: course.name })}</h2>
      <div className="live-banner">{t('live.banner', { code: round.liveCode ?? '' })}</div>
      {round.liveCode && <LiveShareButton code={round.liveCode} />}
      <p className="hint">{t('live.lobbyHint')}</p>
      <ul className="list">
        {players.map((player) => {
          const slot = slots.find((s) => s.player_id === player.id)
          const takenByOther = !!slot?.claimed_by
          return (
            <li key={player.id} className="list-item">
              <span>{player.firstName} {player.lastName}</span>
              <button
                className="secondary"
                disabled={takenByOther || claiming === player.id || !slot}
                onClick={() => handlePick(player.id)}
              >
                {takenByOther ? t('live.claimed') : t('live.pickMe')}
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="error">{error}</p>}
      <div className="stack">
        <button className="secondary" onClick={onWatch}>{t('live.watchButton')}</button>
        <button className="secondary" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
