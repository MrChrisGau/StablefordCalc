import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { isSinglesMatchplay } from '../types'
import {
  buildMatchSides,
  computeMatchHoleOutcomes,
  computeStrokeplayResults,
  formatDiff,
  formatMatchStatus,
  matchStatus,
  matchVariant,
  totalDiffToPar,
} from '../scoring'
import { useTranslation } from '../i18n'

interface Props {
  course: Course
  round: Round
  players: Player[]
  showThru?: boolean
}

export default function MatchplayStatus({ course, round, players, showThru = true }: Props) {
  const { t } = useTranslation()
  const sides = useMemo(() => buildMatchSides(course, round, players), [course, round, players])
  const singles = isSinglesMatchplay(round.gameMode)
  const isNet = matchVariant(round.gameMode) === 'net'

  const status = useMemo(() => {
    if (!sides) return null
    const outcomes = computeMatchHoleOutcomes(course, sides[0], sides[1], round.matchConcessions, matchVariant(round.gameMode))
    return { outcomes, ...matchStatus(outcomes) }
  }, [course, round, sides])

  const playerDiffs = useMemo(() => {
    if (!singles) return null
    return round.players.map((rp) => {
      const player = players.find((p) => p.id === rp.playerId)!
      const tee = course.tees.find((t) => t.id === rp.teeId)!
      const scores = round.scores[rp.playerId] ?? {}
      const results = computeStrokeplayResults(course, tee, player.handicap, scores, isNet ? 'net' : 'gross')
      return totalDiffToPar(results)
    })
  }, [course, round, players, singles, isNet])

  if (!sides || !status) return null
  const [sideA, sideB] = sides

  const leaderLabel = status.leaderSideId === sideA.sideId ? sideA.label : status.leaderSideId === sideB.sideId ? sideB.label : undefined

  return (
    <div className="match-status">
      <div className={`match-player ${status.leaderSideId === sideA.sideId ? 'leading' : ''}`}>
        {sideA.label}
        {isNet && <span className="match-hcp">{t('match.handicapSuffix', { n: sideA.courseHandicap })}</span>}
      </div>
      <div className="match-score">{formatMatchStatus(status, leaderLabel, t)}</div>
      <div className={`match-player ${status.leaderSideId === sideB.sideId ? 'leading' : ''}`}>
        {sideB.label}
        {isNet && <span className="match-hcp">{t('match.handicapSuffix', { n: sideB.courseHandicap })}</span>}
      </div>
      {playerDiffs && (
        <div className="match-side-scores">
          <div className="match-side-score">{formatDiff(playerDiffs[0], t)}</div>
          <div className="match-side-score">{formatDiff(playerDiffs[1], t)}</div>
        </div>
      )}
      {showThru && <div className="match-thru">{t('match.thru', { n: status.holesDecided, total: course.holeCount })}</div>}
    </div>
  )
}
