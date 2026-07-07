import type { Course, HoleInfo, MatchHoleConcession, Player, Round } from '../types'
import { isMatchplay } from '../types'
import { courseHandicap, strokesForHole, holePoints } from '../stableford'
import { formatDiff } from '../scoring'

interface Props {
  course: Course
  round: Round
  hole: HoleInfo
  players: Player[]
  onUpdate: (round: Round) => void
}

export default function HoleEntry({ course, round, hole, players, onUpdate }: Props) {
  const matchplay = isMatchplay(round.gameMode)
  const netVariant = round.gameMode === 'strokeplay_net' || round.gameMode === 'matchplay_net'

  function setStrokes(playerId: string, value: number) {
    if (value < 1) return
    const scores = { ...round.scores, [playerId]: { ...round.scores[playerId], [hole.number]: value } }
    onUpdate({ ...round, scores })
  }

  function setConcession(concession: MatchHoleConcession | undefined) {
    const matchConcessions = { ...round.matchConcessions }
    if (concession) matchConcessions[hole.number] = concession
    else delete matchConcessions[hole.number]
    onUpdate({ ...round, matchConcessions })
  }

  const current = round.matchConcessions?.[hole.number]

  return (
    <div className="entry-list">
      {round.players.map((rp) => {
        const player = players.find((p) => p.id === rp.playerId)!
        const tee = course.tees.find((t) => t.id === rp.teeId)!
        const gross = round.scores[player.id]?.[hole.number]
        const hcp = courseHandicap(player.handicap, tee, course)
        const strokesReceived = strokesForHole(hcp, hole, course.holeCount)

        let resultDisplay = '–'
        if (!matchplay && gross !== undefined) {
          if (round.gameMode === 'stableford') {
            resultDisplay = `${holePoints(gross, hole, strokesReceived)} Pkt`
          } else {
            const par = netVariant ? hole.par + strokesReceived : hole.par
            resultDisplay = formatDiff(gross - par)
          }
        }

        return (
          <div className="entry-row" key={player.id}>
            <div className="entry-name">{player.firstName} {player.lastName}</div>
            <div className="stepper">
              <button onClick={() => setStrokes(player.id, (gross ?? hole.par + 1) - 1)}>−</button>
              <span className="stepper-value">{gross ?? '–'}</span>
              <button onClick={() => setStrokes(player.id, (gross ?? hole.par - 1) + 1)}>+</button>
            </div>
            {!matchplay && <div className="entry-points">{resultDisplay}</div>}
          </div>
        )
      })}

      {matchplay && round.players.length === 2 && (
        <div className="concede-row">
          {round.players.map((rp) => {
            const player = players.find((p) => p.id === rp.playerId)!
            const active = current?.type === 'won' && current.playerId === player.id
            return (
              <button
                key={player.id}
                className={`secondary concede-btn ${active ? 'active' : ''}`}
                onClick={() => setConcession(active ? undefined : { type: 'won', playerId: player.id })}
              >
                {player.firstName} gewinnt
              </button>
            )
          })}
          <button
            className={`secondary concede-btn ${current?.type === 'halved' ? 'active' : ''}`}
            onClick={() => setConcession(current?.type === 'halved' ? undefined : { type: 'halved' })}
          >
            Halbiert
          </button>
        </div>
      )}
    </div>
  )
}
