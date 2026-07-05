import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { computeHoleResults, holesPlayed, totalPoints } from '../stableford'

interface Props {
  round: Round
  course: Course
  players: Player[]
  onUpdate: (round: Round) => void
  onFinish: () => void
}

export default function RoundPlayPage({ round, course, players, onUpdate, onFinish }: Props) {
  const hole = course.holes.find((h) => h.number === round.currentHole) ?? course.holes[0]

  const playerResults = useMemo(() => {
    return round.players.map((rp) => {
      const player = players.find((p) => p.id === rp.playerId)!
      const tee = course.tees.find((t) => t.id === rp.teeId)!
      const results = computeHoleResults(course, tee, player.handicap, round.scores[rp.playerId] ?? {})
      return { player, results, total: totalPoints(results), thru: holesPlayed(results) }
    })
  }, [round, course, players])

  const leaderboard = useMemo(
    () => [...playerResults].sort((a, b) => b.total - a.total),
    [playerResults],
  )

  function setStrokes(playerId: string, value: number) {
    if (value < 1) return
    const scores = { ...round.scores, [playerId]: { ...round.scores[playerId], [hole.number]: value } }
    onUpdate({ ...round, scores })
  }

  function changeHole(delta: number) {
    const next = round.currentHole + delta
    if (next < 1 || next > course.holeCount) return
    onUpdate({ ...round, currentHole: next })
  }

  const allHolesEntered = playerResults.every((pr) => pr.thru === course.holeCount)

  return (
    <div className="page">
      <div className="scoreboard">
        <h2>{course.name}</h2>
        <table>
          <thead>
            <tr>
              <th>Platz</th>
              <th>Spieler</th>
              <th>Thru</th>
              <th>Punkte</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((pr, i) => (
              <tr key={pr.player.id}>
                <td>{i + 1}</td>
                <td>{pr.player.firstName} {pr.player.lastName}</td>
                <td>{pr.thru}/{course.holeCount}</td>
                <td className="points">{pr.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hole-nav">
        <button className="secondary" onClick={() => changeHole(-1)} disabled={round.currentHole <= 1}>‹ Bahn</button>
        <div className="hole-title">
          Bahn {hole.number} · Par {hole.par} · Bahn-HCP {hole.strokeIndex}
        </div>
        <button className="secondary" onClick={() => changeHole(1)} disabled={round.currentHole >= course.holeCount}>Bahn ›</button>
      </div>

      <div className="entry-list">
        {playerResults.map((pr) => {
          const gross = round.scores[pr.player.id]?.[hole.number]
          const result = pr.results.find((r) => r.hole.number === hole.number)
          return (
            <div className="entry-row" key={pr.player.id}>
              <div className="entry-name">{pr.player.firstName} {pr.player.lastName}</div>
              <div className="stepper">
                <button onClick={() => setStrokes(pr.player.id, (gross ?? hole.par + 1) - 1)}>−</button>
                <span className="stepper-value">{gross ?? '–'}</span>
                <button onClick={() => setStrokes(pr.player.id, (gross ?? hole.par - 1) + 1)}>+</button>
              </div>
              <div className="entry-points">{result?.points ?? '–'} Pkt</div>
            </div>
          )
        })}
      </div>

      <div className="hole-grid">
        {course.holes.map((h) => {
          const done = playerResults.every((pr) => round.scores[pr.player.id]?.[h.number] !== undefined)
          return (
            <button
              key={h.number}
              className={`hole-chip ${h.number === round.currentHole ? 'active' : ''} ${done ? 'done' : ''}`}
              onClick={() => onUpdate({ ...round, currentHole: h.number })}
            >
              {h.number}
            </button>
          )
        })}
      </div>

      <div className="actions">
        <button className="danger" onClick={onFinish}>
          {allHolesEntered ? 'Runde abschließen' : 'Runde vorzeitig beenden'}
        </button>
      </div>
    </div>
  )
}
