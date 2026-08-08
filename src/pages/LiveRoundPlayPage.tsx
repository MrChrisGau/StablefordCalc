import type { Course, Player, Round } from '../types'
import { useLiveRoundSync } from '../lib/useLiveRoundSync'
import RoundPlayPage from './RoundPlayPage'
import { useTranslation } from '../i18n'

interface Props {
  round: Round
  course: Course
  players: Player[]
  onUpdate: (round: Round) => void
  onFinish: () => void
}

export default function LiveRoundPlayPage({ round, course, players, onUpdate, onFinish }: Props) {
  const { t } = useTranslation()
  const handleUpdate = useLiveRoundSync(round, onUpdate)
  const isSpectator = !round.claimedPlayerId
  const editablePlayerIds = round.claimedPlayerId ? [round.claimedPlayerId] : []

  return (
    <div>
      <div className="live-banner">
        {t(isSpectator ? 'live.spectatorBanner' : 'live.banner', { code: round.liveCode ?? '' })}
      </div>
      <RoundPlayPage
        round={round}
        course={course}
        players={players}
        onUpdate={handleUpdate}
        onFinish={onFinish}
        editablePlayerIds={editablePlayerIds}
        isSpectator={isSpectator}
      />
    </div>
  )
}
