import { useState } from 'react'
import type { Player } from '../types'
import { deletePlayer, genId, getPlayers, upsertPlayer } from '../storage'
import DecimalInput from '../components/DecimalInput'
import { useTranslation } from '../i18n'

function emptyPlayer(): Player {
  return { id: genId(), firstName: '', lastName: '', handicap: 36, gender: 'M' }
}

export default function PlayersPage() {
  const { t } = useTranslation()
  const [players, setPlayers] = useState<Player[]>(getPlayers())
  const [editing, setEditing] = useState<Player | null>(null)
  const [error, setError] = useState('')

  function refresh() {
    setPlayers(getPlayers())
  }

  function handleDelete(id: string) {
    if (!confirm(t('players.confirmDelete'))) return
    deletePlayer(id)
    refresh()
  }

  function handleSave() {
    if (!editing) return
    if (!editing.firstName.trim() || !editing.lastName.trim()) {
      setError(t('players.errorName'))
      return
    }
    upsertPlayer(editing)
    setEditing(null)
    refresh()
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{players.some((p) => p.id === editing.id) ? t('players.editTitle') : t('players.newTitle')}</h2>

        <label className="field">
          <span>{t('players.firstName')}</span>
          <input
            value={editing.firstName}
            onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>{t('players.lastName')}</span>
          <input
            value={editing.lastName}
            onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>{t('players.handicap')}</span>
          <DecimalInput
            value={editing.handicap}
            onChange={(value) => setEditing({ ...editing, handicap: value })}
          />
        </label>

        <label className="field">
          <span>{t('players.gender')}</span>
          <select
            value={editing.gender}
            onChange={(e) => setEditing({ ...editing, gender: e.target.value as Player['gender'] })}
          >
            <option value="M">{t('common.men')}</option>
            <option value="W">{t('common.women')}</option>
          </select>
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button className="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
          <button className="primary" onClick={handleSave}>{t('common.save')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>{t('players.title')}</h2>
      {players.length === 0 && <p className="hint">{t('players.empty')}</p>}
      <ul className="list">
        {players.map((player) => (
          <li key={player.id} className="list-item">
            <div>
              <strong>{player.firstName} {player.lastName}</strong>
              <div className="muted">
                {t('players.summary', { handicap: player.handicap, gender: player.gender === 'M' ? t('common.men') : t('common.women') })}
              </div>
            </div>
            <div className="list-actions">
              <button className="secondary" onClick={() => setEditing(structuredClone(player))}>{t('common.edit')}</button>
              <button className="danger" onClick={() => handleDelete(player.id)}>{t('common.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={() => { setError(''); setEditing(emptyPlayer()) }}>{t('players.addNew')}</button>
    </div>
  )
}
