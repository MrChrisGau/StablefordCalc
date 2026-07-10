import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { computeHoleResults, courseHandicap, holesPlayed, totalPoints } from '../stableford'
import { computeStrokeplayResults, formatDiff, totalDiffToPar } from '../scoring'

interface Props {
  course: Course
  round: Round
  players: Player[]
  showThru?: boolean
}

interface Row {
  playerId: string
  name: string
  handicap: number
  thru: number
  value: number | undefined
  display: string
}

export default function ResultsTable({ course, round, players, showThru = true }: Props) {
  const isNet = round.gameMode === 'strokeplay_net'
  const isStrokeplay = round.gameMode === 'strokeplay_gross' || round.gameMode === 'strokeplay_net'

  const rows = useMemo<Row[]>(() => {
    const computed = round.players.map((rp) => {
      const player = players.find((p) => p.id === rp.playerId)!
      const tee = course.tees.find((t) => t.id === rp.teeId)!
      const scores = round.scores[rp.playerId] ?? {}
      const name = `${player.firstName} ${player.lastName}`
      const handicap = courseHandicap(player.handicap, tee, course)

      if (isStrokeplay) {
        const results = computeStrokeplayResults(course, tee, player.handicap, scores, isNet ? 'net' : 'gross')
        const value = totalDiffToPar(results)
        return {
          playerId: player.id,
          name,
          handicap,
          thru: results.filter((r) => r.gross !== undefined).length,
          value,
          display: formatDiff(value),
        }
      }

      const results = computeHoleResults(course, tee, player.handicap, scores)
      const value = totalPoints(results)
      return {
        playerId: player.id,
        name,
        handicap,
        thru: holesPlayed(results),
        value,
        display: String(value),
      }
    })

    return [...computed].sort((a, b) => {
      if (isStrokeplay) {
        if (a.value === undefined) return 1
        if (b.value === undefined) return -1
        return a.value - b.value
      }
      return (b.value ?? 0) - (a.value ?? 0)
    })
  }, [course, round, players, isStrokeplay, isNet])

  return (
    <table>
      <thead>
        <tr>
          <th>Platz</th>
          <th>Spieler</th>
          <th>Vorgabe</th>
          {showThru && <th>Thru</th>}
          <th>{isStrokeplay ? '+/-' : 'Punkte'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.playerId}>
            <td>{i + 1}</td>
            <td>{row.name}</td>
            <td>{row.handicap}</td>
            {showThru && <td>{row.thru}/{course.holeCount}</td>}
            <td className="points">{row.display}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
