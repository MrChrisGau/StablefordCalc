import { useState } from 'react'
import type { Course, Player, Round } from '../types'
import { genId } from '../storage'
import { fetchLiveRoundByCode } from '../lib/liveRound'
import { useTranslation } from '../i18n'

interface Props {
  courses: Course[]
  onJoin: (round: Round, players: Player[]) => void
  onCancel: () => void
}

export default function JoinLiveRoundPage({ courses, onJoin, onCancel }: Props) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      const result = await fetchLiveRoundByCode(code.trim())
      if (!result) {
        setError(t('live.joinNotFound'))
        return
      }
      const course = courses.find((c) => c.id === result.round.course_id)
      if (!course) {
        setError(t('live.joinNoCourse'))
        return
      }
      const players: Player[] = result.players.map((p) => ({
        id: p.player_id,
        firstName: p.first_name,
        lastName: p.last_name,
        handicap: p.handicap,
        gender: p.gender,
      }))
      const round: Round = {
        id: genId(),
        courseId: course.id,
        date: new Date().toISOString(),
        players: result.players.map((p) => ({ playerId: p.player_id, teeId: p.tee_id })),
        scores: {},
        status: 'in_progress',
        currentHole: 1,
        gameMode: result.round.game_mode,
        liveRoundId: result.round.id,
        liveCode: result.round.code,
      }
      onJoin(round, players)
    } catch (err) {
      setError(t('live.joinError'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h2>{t('live.joinTitle')}</h2>
      <label className="field">
        <span>{t('live.codeLabel')}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('live.codePlaceholder')}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="secondary" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary" onClick={handleJoin} disabled={loading}>{t('live.joinButton')}</button>
      </div>
    </div>
  )
}
