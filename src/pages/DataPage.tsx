import { useRef, useState, type ChangeEvent } from 'react'
import type { Course, Player } from '../types'
import { getCourses, getPlayers, upsertCourse, upsertPlayer } from '../storage'
import { useTranslation, type Lang } from '../i18n'

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
  const { t, lang, setLang } = useTranslation()
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
      setMessage(t('data.errorRead'))
      return
    }
    if (!isBackup(data)) {
      setMessage(t('data.errorInvalid'))
      return
    }
    const proceed = confirm(t('data.confirmImport', { courses: data.courses.length, players: data.players.length }))
    if (!proceed) return
    data.courses.forEach(upsertCourse)
    data.players.forEach(upsertPlayer)
    setMessage(t('data.importSuccess', { courses: data.courses.length, players: data.players.length }))
  }

  return (
    <div className="page">
      <h2>{t('data.title')}</h2>

      <label className="field">
        <span>{t('data.language')}</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          <option value="de">{t('data.languageDe')}</option>
          <option value="en">{t('data.languageEn')}</option>
        </select>
      </label>

      <p className="hint">{t('data.hint')}</p>
      <div className="stack">
        <button className="primary" onClick={handleExport}>{t('data.export')}</button>
        <button className="secondary" onClick={() => fileInputRef.current?.click()}>{t('data.import')}</button>
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
