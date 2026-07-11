import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { computeHoleResults, courseHandicap, holesPlayed, totalPoints } from '../stableford'
import { computeStrokeplayResults, formatDiff, totalDiffToPar } from '../scoring'
import { useTranslation } from '../i18n'

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
  grossTotal: number | undefined
  value: number | undefined
  display: string
}

export default function ResultsTable({ course, round, players, showThru = true }: Props) {
  const { t } = useTranslation()
  const isNet = round.gameMode === 'strokeplay_net'
  const isStrokeplay = round.gameMode === 'strokeplay_gross' || round.gameMode === 'strokeplay_net'
  const isStableford = round.gameMode === 'stableford'

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
          grossTotal: undefined,
          value,
          display: formatDiff(value, t),
        }
      }

      const results = computeHoleResults(course, tee, player.handicap, scores)
      const value = totalPoints(results)
      const played = results.filter((r) => r.gross !== undefined)
      return {
        playerId: player.id,
        name,
        handicap,
        thru: holesPlayed(results),
        grossTotal: played.length === 0 ? undefined : played.reduce((sum, r) => sum + (r.gross ?? 0), 0),
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
  }, [course, round, players, isStrokeplay, isNet, t])

  return (
    <table>
      <thead>
        <tr>
          <th>{t('results.rank')}</th>
          <th>{t('results.player')}</th>
          <th>{t('results.handicap')}</th>
          {showThru && <th>{t('results.thru')}</th>}
          {isStableford && <th>{t('results.gross')}</th>}
          <th>{isStrokeplay ? t('results.diff') : t('results.points')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.playerId}>
            <td>{i + 1}</td>
            <td>{row.name}</td>
            <td>{row.handicap}</td>
            {showThru && <td>{row.thru}/{course.holeCount}</td>}
            {isStableford && <td>{row.grossTotal ?? '–'}</td>}
            <td className="points">{row.display}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
