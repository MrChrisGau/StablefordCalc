import type { Course, HoleInfo, MatchHoleConcession, Player, Round } from '../types'
import { isMatchplay, isTeamMatchplay } from '../types'
import { courseHandicap, strokesForHole, holePoints } from '../stableford'
import { buildMatchSides, formatDiff } from '../scoring'

interface Props {
  course: Course
  round: Round
  hole: HoleInfo
  players: Player[]
  onUpdate: (round: Round) => void
}

export default function HoleEntry({ course, round, hole, players, onUpdate }: Props) {
  const matchplay = isMatchplay(round.gameMode)
  const teamMatchplay = isTeamMatchplay(round.gameMode)
  const foursomes = round.gameMode === 'matchplay_foursomes'
  const netVariant = round.gameMode === 'strokeplay_net' || round.gameMode === 'matchplay_net'

  function setStrokes(playerId: string, value: number) {
    if (value < 1) return
    const scores = { ...round.scores, [playerId]: { ...round.scores[playerId], [hole.number]: value } }
    onUpdate({ ...round, scores })
  }

  function setTeamStrokes(teamIndex: number, value: number) {
    if (value < 1) return
    const teamScores = {
      ...round.teamScores,
      [teamIndex]: { ...round.teamScores?.[teamIndex], [hole.number]: value },
    }
    onUpdate({ ...round, teamScores })
  }

  function setConcession(concession: MatchHoleConcession | undefined) {
    const matchConcessions = { ...round.matchConcessions }
    if (concession) matchConcessions[hole.number] = concession
    else delete matchConcessions[hole.number]
    onUpdate({ ...round, matchConcessions })
  }

  const current = round.matchConcessions?.[hole.number]
  const sides = teamMatchplay ? buildMatchSides(course, round, players) : null

  return (
    <div className="entry-list">
      {foursomes && sides
        ? sides.map((side, teamIndex) => {
            const value = round.teamScores?.[teamIndex]?.[hole.number]
            return (
              <div className="entry-row" key={side.sideId}>
                <div className="entry-name">{side.label}</div>
                <div className="stepper">
                  <button onClick={() => setTeamStrokes(teamIndex, (value ?? hole.par + 1) - 1)}>−</button>
                  <span className="stepper-value">{value ?? '–'}</span>
                  <button onClick={() => setTeamStrokes(teamIndex, (value ?? hole.par - 1) + 1)}>+</button>
                </div>
              </div>
            )
          })
        : round.players.map((rp) => {
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

      {matchplay && (teamMatchplay ? !!sides : round.players.length === 2) && (
        <div className="concede-row">
          {(teamMatchplay ? sides! : round.players.map((rp) => {
            const player = players.find((p) => p.id === rp.playerId)!
            return { sideId: player.id, label: `${player.firstName}` }
          })).map((side) => {
            const active = current?.type === 'won' && current.sideId === side.sideId
            return (
              <button
                key={side.sideId}
                className={`secondary concede-btn ${active ? 'active' : ''}`}
                onClick={() => setConcession(active ? undefined : { type: 'won', sideId: side.sideId })}
              >
                {side.label} gewinnt
              </button>
            )
          })}
          <button
            className={`secondary concede-btn ${current?.type === 'halved' ? 'active' : ''}`}
            onClick={() => setConcession(current?.type === 'halved' ? undefined : { type: 'halved' })}
          >
            Geteilt
          </button>
        </div>
      )}
    </div>
  )
}
