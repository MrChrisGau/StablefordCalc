import { useState } from 'react'
import type { Player } from '../types'
import { deletePlayer, genId, getPlayers, upsertPlayer } from '../storage'
import DecimalInput from '../components/DecimalInput'

function emptyPlayer(): Player {
  return { id: genId(), firstName: '', lastName: '', handicap: 36, gender: 'M' }
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>(getPlayers())
  const [editing, setEditing] = useState<Player | null>(null)
  const [error, setError] = useState('')

  function refresh() {
    setPlayers(getPlayers())
  }

  function handleDelete(id: string) {
    if (!confirm('Diesen Spieler wirklich löschen?')) return
    deletePlayer(id)
    refresh()
  }

  function handleSave() {
    if (!editing) return
    if (!editing.firstName.trim() || !editing.lastName.trim()) {
      setError('Bitte Vor- und Nachnamen angeben.')
      return
    }
    upsertPlayer(editing)
    setEditing(null)
    refresh()
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{players.some((p) => p.id === editing.id) ? 'Spieler bearbeiten' : 'Neuer Spieler'}</h2>

        <label className="field">
          <span>Vorname</span>
          <input
            value={editing.firstName}
            onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Name</span>
          <input
            value={editing.lastName}
            onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Handicap</span>
          <DecimalInput
            value={editing.handicap}
            onChange={(value) => setEditing({ ...editing, handicap: value })}
          />
        </label>

        <label className="field">
          <span>Geschlecht</span>
          <select
            value={editing.gender}
            onChange={(e) => setEditing({ ...editing, gender: e.target.value as Player['gender'] })}
          >
            <option value="M">Herren</option>
            <option value="W">Damen</option>
          </select>
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button className="secondary" onClick={() => setEditing(null)}>Abbrechen</button>
          <button className="primary" onClick={handleSave}>Speichern</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>Spieler</h2>
      {players.length === 0 && <p className="hint">Noch keine Spieler angelegt.</p>}
      <ul className="list">
        {players.map((player) => (
          <li key={player.id} className="list-item">
            <div>
              <strong>{player.firstName} {player.lastName}</strong>
              <div className="muted">
                HCP {player.handicap} · {player.gender === 'M' ? 'Herren' : 'Damen'}
              </div>
            </div>
            <div className="list-actions">
              <button className="secondary" onClick={() => setEditing(structuredClone(player))}>Bearbeiten</button>
              <button className="danger" onClick={() => handleDelete(player.id)}>Löschen</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={() => { setError(''); setEditing(emptyPlayer()) }}>+ Neuer Spieler</button>
    </div>
  )
}
