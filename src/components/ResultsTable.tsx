import { useMemo } from 'react'
import type { Course, Player, Round } from '../types'
import { computeHoleResults, totalGrossPoints, totalPoints } from '../stableford'
import { computeStrokeplayResults, formatDiff, totalDiffToPar } from '../scoring'
import { useTranslation } from '../i18n'

interface Props {
  course: Course
  round: Round
  players: Player[]
}

interface Row {
  playerId: string
  name: string
  strokesTotal: number | undefined
  grossPoints: number | undefined
  secondaryDisplay: string | undefined
  value: number | undefined
  display: string
}

export default function ResultsTable({ course, round, players }: Props) {
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

      if (isStrokeplay) {
        const results = computeStrokeplayResults(course, tee, player.handicap, scores, isNet ? 'net' : 'gross')
        const value = totalDiffToPar(results)
        const played = results.filter((r) => r.gross !== undefined)
        const strokesTotal = played.length === 0 ? undefined : played.reduce((sum, r) => sum + (r.gross ?? 0), 0)
        const grossDiff = isNet
          ? totalDiffToPar(computeStrokeplayResults(course, tee, player.handicap, scores, 'gross'))
          : undefined
        return {
          playerId: player.id,
          name,
          strokesTotal: isNet ? undefined : strokesTotal,
          grossPoints: undefined,
          secondaryDisplay: isNet ? formatDiff(grossDiff, t) : undefined,
          value,
          display: formatDiff(value, t),
        }
      }

      const results = computeHoleResults(course, tee, player.handicap, scores, round.pickedUp?.[rp.playerId])
      const value = totalPoints(results)
      const played = results.filter((r) => r.gross !== undefined)
      return {
        playerId: player.id,
        name,
        strokesTotal: played.length === 0 ? undefined : played.reduce((sum, r) => sum + (r.gross ?? 0), 0),
        grossPoints: totalGrossPoints(results),
        secondaryDisplay: undefined,
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
          <th className="col-player">{t('results.player')}</th>
          {isStableford && <th>{t('results.strokesAbbr')}</th>}
          {isStableford && <th>{t('results.gross')}</th>}
          {isStrokeplay && !isNet && <th>{t('results.strokes')}</th>}
          {isStrokeplay && isNet && <th>{t('results.grossDiff')}</th>}
          <th>{isStrokeplay ? (isNet ? t('results.netDiff') : t('results.diff')) : t('results.net')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.playerId}>
            <td className="col-player">{row.name}</td>
            {isStableford && <td>{row.strokesTotal ?? '–'}</td>}
            {isStableford && <td>{row.grossPoints ?? '–'}</td>}
            {isStrokeplay && !isNet && <td>{row.strokesTotal ?? '–'}</td>}
            {isStrokeplay && isNet && <td>{row.secondaryDisplay ?? '–'}</td>}
            <td className="points">{row.display}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
