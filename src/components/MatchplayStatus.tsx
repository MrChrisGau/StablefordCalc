import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { computeMatchHoleOutcomes, formatMatchStatus, matchStatus } from '../scoring'

interface Props {
  course: Course
  round: Round
  players: Player[]
  showThru?: boolean
}

export default function MatchplayStatus({ course, round, players, showThru = true }: Props) {
  const isNet = round.gameMode === 'matchplay_net'

  const [rpA, rpB] = round.players
  const playerA = players.find((p) => p.id === rpA?.playerId)
  const playerB = players.find((p) => p.id === rpB?.playerId)
  const teeA = course.tees.find((t) => t.id === rpA?.teeId)
  const teeB = course.tees.find((t) => t.id === rpB?.teeId)

  const status = useMemo(() => {
    if (!playerA || !playerB || !teeA || !teeB) return null
    const outcomes = computeMatchHoleOutcomes(
      course,
      { playerId: playerA.id, tee: teeA, handicapIndex: playerA.handicap, scores: round.scores[playerA.id] ?? {} },
      { playerId: playerB.id, tee: teeB, handicapIndex: playerB.handicap, scores: round.scores[playerB.id] ?? {} },
      round.matchConcessions,
      isNet ? 'net' : 'gross',
    )
    return { outcomes, ...matchStatus(outcomes) }
  }, [course, round, playerA, playerB, teeA, teeB, isNet])

  if (!playerA || !playerB || !status) return null

  const leaderName = status.leaderId === playerA.id ? playerA.firstName : status.leaderId === playerB.id ? playerB.firstName : undefined

  return (
    <div className="match-status">
      <div className={`match-player ${status.leaderId === playerA.id ? 'leading' : ''}`}>
        {playerA.firstName} {playerA.lastName}
      </div>
      <div className="match-score">{formatMatchStatus(status, leaderName)}</div>
      <div className={`match-player ${status.leaderId === playerB.id ? 'leading' : ''}`}>
        {playerB.firstName} {playerB.lastName}
      </div>
      {showThru && <div className="match-thru">Thru {status.holesDecided}/{course.holeCount}</div>}
    </div>
  )
}
