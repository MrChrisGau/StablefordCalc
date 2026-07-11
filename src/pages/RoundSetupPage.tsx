import { useMemo, useState } from 'react'
import type { Course, GameMode, Player, Round, RoundPlayer, RoundTeam } from '../types'
import { isMatchplay, isSinglesMatchplay, isTeamMatchplay } from '../types'
import { genId } from '../storage'
import { useTranslation, type TFunc } from '../i18n'

const GAME_MODES: GameMode[] = [
  'stableford',
  'strokeplay_gross',
  'strokeplay_net',
  'matchplay_gross',
  'matchplay_net',
  'matchplay_fourball',
  'matchplay_foursomes',
]

function gameModeLabel(mode: GameMode, t: TFunc): string {
  return t(`gameMode.${mode}`)
}

function requiredPlayerCount(mode: GameMode): number | null {
  if (isSinglesMatchplay(mode)) return 2
  if (isTeamMatchplay(mode)) return 4
  return null
}

interface Props {
  courses: Course[]
  players: Player[]
  onStart: (round: Round) => void
}

export default function RoundSetupPage({ courses, players, onStart }: Props) {
  const { t } = useTranslation()
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [selection, setSelection] = useState<RoundPlayer[]>([])
  const [gameMode, setGameMode] = useState<GameMode>('stableford')
  const [teamOverride, setTeamOverride] = useState<Record<string, 0 | 1>>({})
  const [error, setError] = useState('')

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])

  function defaultTeeFor(player: Player): string {
    if (!course) return ''
    const match = course.tees.find((t) => t.gender === player.gender)
    return (match ?? course.tees[0])?.id ?? ''
  }

  function teamIndexOf(playerId: string, idx: number): 0 | 1 {
    return teamOverride[playerId] ?? (idx < 2 ? 0 : 1)
  }

  function toggleTeam(playerId: string, idx: number) {
    setTeamOverride({ ...teamOverride, [playerId]: teamIndexOf(playerId, idx) === 0 ? 1 : 0 })
  }

  function togglePlayer(player: Player) {
    setError('')
    const exists = selection.some((s) => s.playerId === player.id)
    const next = exists
      ? selection.filter((s) => s.playerId !== player.id)
      : selection.length < 4
        ? [...selection, { playerId: player.id, teeId: defaultTeeFor(player) }]
        : null
    if (next === null) {
      setError(t('roundSetup.errorMaxPlayers'))
      return
    }
    setSelection(next)
    const required = requiredPlayerCount(gameMode)
    if (required !== null && next.length !== required) {
      setGameMode('stableford')
    }
  }

  function setTee(playerId: string, teeId: string) {
    setSelection(selection.map((s) => (s.playerId === playerId ? { ...s, teeId } : s)))
  }

  function handleStart() {
    if (!course) {
      setError(t('roundSetup.errorNoCourse'))
      return
    }
    if (selection.length === 0) {
      setError(t('roundSetup.errorNoPlayers'))
      return
    }
    if (selection.some((s) => !s.teeId)) {
      setError(t('roundSetup.errorNoTee'))
      return
    }
    const required = requiredPlayerCount(gameMode)
    if (required !== null && selection.length !== required) {
      setError(t('roundSetup.errorModeRequiresPlayers', { mode: gameModeLabel(gameMode, t), count: required }))
      return
    }

    let teams: [RoundTeam, RoundTeam] | undefined
    if (isTeamMatchplay(gameMode)) {
      const team0 = selection.filter((s, idx) => teamIndexOf(s.playerId, idx) === 0).map((s) => s.playerId)
      const team1 = selection.filter((s, idx) => teamIndexOf(s.playerId, idx) === 1).map((s) => s.playerId)
      if (team0.length !== 2 || team1.length !== 2) {
        setError(t('roundSetup.errorTeams'))
        return
      }
      teams = [{ playerIds: team0 as [string, string] }, { playerIds: team1 as [string, string] }]
    }

    const round: Round = {
      id: genId(),
      courseId: course.id,
      date: new Date().toISOString(),
      players: selection,
      scores: Object.fromEntries(selection.map((s) => [s.playerId, {}])),
      status: 'in_progress',
      currentHole: 1,
      gameMode,
      matchConcessions: isMatchplay(gameMode) ? {} : undefined,
      teams,
      teamScores: gameMode === 'matchplay_foursomes' ? { 0: {}, 1: {} } : undefined,
    }
    onStart(round)
  }

  if (courses.length === 0) {
    return <div className="page"><p className="hint">{t('roundSetup.needCourse')}</p></div>
  }
  if (players.length === 0) {
    return <div className="page"><p className="hint">{t('roundSetup.needPlayers')}</p></div>
  }

  return (
    <div className="page">
      <h2>{t('roundSetup.title')}</h2>

      <label className="field">
        <span>{t('roundSetup.course')}</span>
        <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSelection([]) }}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <h3>{t('roundSetup.playersMax')}</h3>
      <ul className="list">
        {players.map((player) => {
          const sel = selection.find((s) => s.playerId === player.id)
          return (
            <li key={player.id} className="list-item">
              <label className="checkbox-row">
                <input type="checkbox" checked={!!sel} onChange={() => togglePlayer(player)} />
                <span>{t('roundSetup.playerSummary', { first: player.firstName, last: player.lastName, handicap: player.handicap })}</span>
              </label>
              {sel && course && (
                <select value={sel.teeId} onChange={(e) => setTee(player.id, e.target.value)}>
                  {course.tees.map((tee) => (
                    <option key={tee.id} value={tee.id}>
                      {tee.name} ({tee.gender === 'M' ? t('common.men') : t('common.women')})
                    </option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>

      <label className="field">
        <span>{t('roundSetup.gameMode')}</span>
        <select value={gameMode} onChange={(e) => setGameMode(e.target.value as GameMode)}>
          {GAME_MODES.map((mode) => {
            const required = requiredPlayerCount(mode)
            return (
              <option key={mode} value={mode} disabled={required !== null && selection.length !== required}>
                {gameModeLabel(mode, t)}
              </option>
            )
          })}
        </select>
        <span className="muted">{t('roundSetup.matchplayHint')}</span>
      </label>

      {isTeamMatchplay(gameMode) && selection.length === 4 && (
        <label className="field">
          <span>{t('roundSetup.teams')}</span>
          <div className="stack">
            {selection.map((s, idx) => {
              const player = players.find((p) => p.id === s.playerId)!
              const team = teamIndexOf(s.playerId, idx)
              return (
                <div className="team-assign-row" key={s.playerId}>
                  <span className="entry-name">{player.firstName} {player.lastName}</span>
                  <button type="button" className="secondary" onClick={() => toggleTeam(s.playerId, idx)}>
                    {t('roundSetup.team', { n: team + 1 })}
                  </button>
                </div>
              )
            })}
          </div>
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <button className="primary" onClick={handleStart}>{t('roundSetup.start')}</button>
    </div>
  )
}
