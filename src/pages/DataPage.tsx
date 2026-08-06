import { useRef, useState, type ChangeEvent } from 'react'
import type { Course, Player } from '../types'
import { getPlayers, upsertPlayer } from '../storage'
import { useCourses } from '../lib/CoursesContext'
import { useTranslation, type Lang } from '../i18n'

interface CourseBackup {
  courses: Course[]
}

interface PlayerBackup {
  players: Player[]
}

function isCourseBackup(data: unknown): data is CourseBackup {
  return !!data && typeof data === 'object' && Array.isArray((data as CourseBackup).courses)
}

function isPlayerBackup(data: unknown): data is PlayerBackup {
  return !!data && typeof data === 'object' && Array.isArray((data as PlayerBackup).players)
}

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function DataPage() {
  const { t, lang, setLang } = useTranslation()
  const { courses, saveCourse } = useCourses()
  const courseFileInputRef = useRef<HTMLInputElement>(null)
  const playerFileInputRef = useRef<HTMLInputElement>(null)
  const [courseMessage, setCourseMessage] = useState('')
  const [playerMessage, setPlayerMessage] = useState('')

  function handleExportCourses() {
    download(`stableford-plaetze-${new Date().toISOString().slice(0, 10)}.json`, { courses } satisfies CourseBackup)
  }

  function handleExportPlayers() {
    download(`stableford-spieler-${new Date().toISOString().slice(0, 10)}.json`, { players: getPlayers() } satisfies PlayerBackup)
  }

  async function handleCoursesFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCourseMessage('')
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      setCourseMessage(t('data.errorRead'))
      return
    }
    if (!isCourseBackup(data)) {
      setCourseMessage(t('data.errorInvalidCourses'))
      return
    }
    const proceed = confirm(t('data.confirmImportCourses', { courses: data.courses.length }))
    if (!proceed) return
    data.courses.forEach(saveCourse)
    setCourseMessage(t('data.importSuccessCourses', { courses: data.courses.length }))
  }

  async function handlePlayersFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPlayerMessage('')
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      setPlayerMessage(t('data.errorRead'))
      return
    }
    if (!isPlayerBackup(data)) {
      setPlayerMessage(t('data.errorInvalidPlayers'))
      return
    }
    const proceed = confirm(t('data.confirmImportPlayers', { players: data.players.length }))
    if (!proceed) return
    data.players.forEach(upsertPlayer)
    setPlayerMessage(t('data.importSuccessPlayers', { players: data.players.length }))
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

      <h3>{t('data.coursesTitle')}</h3>
      <p className="hint">{t('data.coursesHint')}</p>
      <div className="stack">
        <button className="primary" onClick={handleExportCourses}>{t('data.export')}</button>
        <button className="secondary" onClick={() => courseFileInputRef.current?.click()}>{t('data.import')}</button>
      </div>
      <input
        ref={courseFileInputRef}
        type="file"
        accept="application/json"
        className="hidden-file-input"
        onChange={handleCoursesFileSelected}
      />
      {courseMessage && <p className="hint">{courseMessage}</p>}

      <h3>{t('data.playersTitle')}</h3>
      <p className="hint">{t('data.playersHint')}</p>
      <div className="stack">
        <button className="primary" onClick={handleExportPlayers}>{t('data.export')}</button>
        <button className="secondary" onClick={() => playerFileInputRef.current?.click()}>{t('data.import')}</button>
      </div>
      <input
        ref={playerFileInputRef}
        type="file"
        accept="application/json"
        className="hidden-file-input"
        onChange={handlePlayersFileSelected}
      />
      {playerMessage && <p className="hint">{playerMessage}</p>}
    </div>
  )
}
