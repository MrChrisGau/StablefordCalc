import type { Course, HoleInfo, MatchHoleConcession, Player, Round } from '../types'
import { isMatchplay, isTeamMatchplay } from '../types'
import { courseHandicap, effectivePar, strokesForHole, holePoints } from '../stableford'
import { buildMatchSides, formatDiff } from '../scoring'
import { useTranslation } from '../i18n'

interface Props {
  course: Course
  round: Round
  hole: HoleInfo
  players: Player[]
  onUpdate: (round: Round) => void
}

export default function HoleEntry({ course, round, hole, players, onUpdate }: Props) {
  const { t } = useTranslation()
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

  function setPickedUp(playerId: string, value: boolean) {
    const pickedUp = { ...round.pickedUp }
    const playerPickedUp = { ...pickedUp[playerId] }
    if (value) playerPickedUp[hole.number] = true
    else delete playerPickedUp[hole.number]
    pickedUp[playerId] = playerPickedUp
    onUpdate({ ...round, pickedUp })
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
            const par = effectivePar(hole, tee)
            const stableford = round.gameMode === 'stableford'
            const isPickedUp = stableford && !!round.pickedUp?.[player.id]?.[hole.number]

            let resultDisplay = '–'
            if (!matchplay) {
              if (isPickedUp) {
                resultDisplay = t('holeEntry.points', { points: 0 })
              } else if (gross !== undefined) {
                if (stableford) {
                  resultDisplay = t('holeEntry.points', { points: holePoints(gross, par, strokesReceived) })
                } else {
                  const netPar = netVariant ? par + strokesReceived : par
                  resultDisplay = formatDiff(gross - netPar, t)
                }
              }
            }

            if (stableford) {
              return (
                <div className="entry-row entry-row-stableford" key={player.id}>
                  <div className="entry-row-line">
                    <div className="entry-name">{player.firstName} {player.lastName}</div>
                    <div className="entry-points">{resultDisplay}</div>
                  </div>
                  <div className="entry-row-line">
                    {isPickedUp ? (
                      <div className="entry-pickedup">{t('holeEntry.pickedUp')}</div>
                    ) : (
                      <div className="stepper">
                        <button onClick={() => setStrokes(player.id, (gross ?? par + 1) - 1)}>−</button>
                        <span className="stepper-value">{gross ?? '–'}</span>
                        <button onClick={() => setStrokes(player.id, (gross ?? par - 1) + 1)}>+</button>
                      </div>
                    )}
                    <button
                      className={`entry-strike-btn ${isPickedUp ? 'active' : ''}`}
                      onClick={() => setPickedUp(player.id, !isPickedUp)}
                    >
                      {t('holeEntry.pickedUp')}
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div className="entry-row" key={player.id}>
                <div className="entry-name">{player.firstName} {player.lastName}</div>
                <div className="stepper">
                  <button onClick={() => setStrokes(player.id, (gross ?? par + 1) - 1)}>−</button>
                  <span className="stepper-value">{gross ?? '–'}</span>
                  <button onClick={() => setStrokes(player.id, (gross ?? par - 1) + 1)}>+</button>
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
                {t('holeEntry.wins', { name: side.label })}
              </button>
            )
          })}
          <button
            className={`secondary concede-btn ${current?.type === 'halved' ? 'active' : ''}`}
            onClick={() => setConcession(current?.type === 'halved' ? undefined : { type: 'halved' })}
          >
            {t('holeEntry.halved')}
          </button>
        </div>
      )}
    </div>
  )
}
