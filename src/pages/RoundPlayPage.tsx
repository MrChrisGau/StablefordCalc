import type { Course, Player, Round } from '../types'
import { isMatchplay } from '../types'
import ResultsTable from '../components/ResultsTable'
import MatchplayStatus from '../components/MatchplayStatus'
import HoleEntry from '../components/HoleEntry'
import { useTranslation } from '../i18n'

interface Props {
  round: Round
  course: Course
  players: Player[]
  onUpdate: (round: Round) => void
  onFinish: () => void
}

export default function RoundPlayPage({ round, course, players, onUpdate, onFinish }: Props) {
  const { t } = useTranslation()
  const hole = course.holes.find((h) => h.number === round.currentHole) ?? course.holes[0]
  const matchplay = isMatchplay(round.gameMode)

  function changeHole(delta: number) {
    const next = round.currentHole + delta
    if (next < 1 || next > course.holeCount) return
    onUpdate({ ...round, currentHole: next })
  }

  function isHoleDone(holeNumber: number): boolean {
    if (matchplay && round.matchConcessions?.[holeNumber]) return true
    if (round.gameMode === 'matchplay_foursomes') {
      return round.teamScores?.[0]?.[holeNumber] !== undefined && round.teamScores?.[1]?.[holeNumber] !== undefined
    }
    return round.players.every((rp) => round.scores[rp.playerId]?.[holeNumber] !== undefined)
  }

  const allHolesEntered = course.holes.every((h) => isHoleDone(h.number))

  return (
    <div className="page">
      <div className="scoreboard">
        <h2>{course.name}</h2>
        {matchplay ? (
          <MatchplayStatus course={course} round={round} players={players} />
        ) : (
          <ResultsTable course={course} round={round} players={players} />
        )}
      </div>

      <div className="hole-nav">
        <button className="secondary" onClick={() => changeHole(-1)} disabled={round.currentHole <= 1}>{t('roundPlay.prevHole')}</button>
        <div className="hole-title">
          {t('roundPlay.holeTitle', { number: hole.number, par: hole.par, si: hole.strokeIndex })}
        </div>
        <button className="secondary" onClick={() => changeHole(1)} disabled={round.currentHole >= course.holeCount}>{t('roundPlay.nextHole')}</button>
      </div>

      <HoleEntry course={course} round={round} hole={hole} players={players} onUpdate={onUpdate} />

      <div className="hole-grid">
        {course.holes.map((h) => (
          <button
            key={h.number}
            className={`hole-chip ${h.number === round.currentHole ? 'active' : ''} ${isHoleDone(h.number) ? 'done' : ''}`}
            onClick={() => onUpdate({ ...round, currentHole: h.number })}
          >
            {h.number}
          </button>
        ))}
      </div>

      <div className="actions">
        <button className="danger" onClick={onFinish}>
          {allHolesEntered ? t('roundPlay.finish') : t('roundPlay.finishEarly')}
        </button>
      </div>
    </div>
  )
}
