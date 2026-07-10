import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { buildMatchSides, computeMatchHoleOutcomes, formatMatchStatus, matchStatus, matchVariant } from '../scoring'

interface Props {
  course: Course
  round: Round
  players: Player[]
  showThru?: boolean
}

export default function MatchplayStatus({ course, round, players, showThru = true }: Props) {
  const sides = useMemo(() => buildMatchSides(course, round, players), [course, round, players])

  const status = useMemo(() => {
    if (!sides) return null
    const outcomes = computeMatchHoleOutcomes(course, sides[0], sides[1], round.matchConcessions, matchVariant(round.gameMode))
    return { outcomes, ...matchStatus(outcomes) }
  }, [course, round, sides])

  if (!sides || !status) return null
  const [sideA, sideB] = sides
  const isNet = matchVariant(round.gameMode) === 'net'

  const leaderLabel = status.leaderSideId === sideA.sideId ? sideA.label : status.leaderSideId === sideB.sideId ? sideB.label : undefined

  return (
    <div className="match-status">
      <div className={`match-player ${status.leaderSideId === sideA.sideId ? 'leading' : ''}`}>
        {sideA.label}
        {isNet && <span className="match-hcp"> (Vorgabe {sideA.courseHandicap})</span>}
      </div>
      <div className="match-score">{formatMatchStatus(status, leaderLabel)}</div>
      <div className={`match-player ${status.leaderSideId === sideB.sideId ? 'leading' : ''}`}>
        {sideB.label}
        {isNet && <span className="match-hcp"> (Vorgabe {sideB.courseHandicap})</span>}
      </div>
      {showThru && <div className="match-thru">Thru {status.holesDecided}/{course.holeCount}</div>}
    </div>
  )
}
