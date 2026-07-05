import { useRef, useState, type ChangeEvent } from 'react'
import type { Course, Player } from '../types'
import { getCourses, getPlayers, upsertCourse, upsertPlayer } from '../storage'

interface Backup {
  courses: Course[]
  players: Player[]
}

function isBackup(data: unknown): data is Backup {
  return (
    !!data &&
    typeof data === 'object' &&
    Array.isArray((data as Backup).courses) &&
    Array.isArray((data as Backup).players)
  )
}

export default function DataPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  function handleExport() {
    const backup: Backup = { courses: getCourses(), players: getPlayers() }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stableford-daten-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage('')
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      setMessage('Die Datei konnte nicht gelesen werden.')
      return
    }
    if (!isBackup(data)) {
      setMessage('Die Datei enthält keine gültigen Stableford-Daten.')
      return
    }
    const proceed = confirm(
      `${data.courses.length} Plätze und ${data.players.length} Spieler importieren? Bestehende Einträge mit gleicher ID werden überschrieben.`,
    )
    if (!proceed) return
    data.courses.forEach(upsertCourse)
    data.players.forEach(upsertPlayer)
    setMessage(`${data.courses.length} Plätze und ${data.players.length} Spieler importiert.`)
  }

  return (
    <div className="page">
      <h2>Daten sichern</h2>
      <p className="hint">
        Exportiere Plätze und Spieler als Datei, um sie zu sichern oder auf ein anderes Gerät zu übertragen.
      </p>
      <div className="stack">
        <button className="primary" onClick={handleExport}>Daten exportieren</button>
        <button className="secondary" onClick={() => fileInputRef.current?.click()}>Daten importieren</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-file-input"
        onChange={handleFileSelected}
      />
      {message && <p className="hint">{message}</p>}
    </div>
  )
}
