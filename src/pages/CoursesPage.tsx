import { useState } from 'react'
import type { Course, HoleInfo, Tee } from '../types'
import { deleteCourse, genId, getCourses, upsertCourse } from '../storage'
import { totalPar } from '../stableford'
import DecimalInput from '../components/DecimalInput'
import OptionalIntInput from '../components/OptionalIntInput'
import { useTranslation } from '../i18n'

function emptyHoles(count: number): HoleInfo[] {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }))
}

function emptyCourse(): Course {
  return { id: genId(), name: '', holeCount: 18, tees: [], holes: emptyHoles(18) }
}

function emptyTee(): Tee {
  return { id: genId(), name: '', gender: 'M', courseRating: 70, slope: 125 }
}

// Feste Spaltenbreiten statt Gleichverteilung: bei vielen Abschlägen sollen die
// Eingabefelder lesbar bleiben, die Tabelle scrollt dann horizontal statt die
// Zahlen unleserlich zusammenzuquetschen.
function holesGridColumns(teeCount: number): string {
  return `2.4rem 3.2rem repeat(${teeCount}, 3.6rem) minmax(3.6rem, 1fr)`
}

export default function CoursesPage() {
  const { t } = useTranslation()
  const [courses, setCourses] = useState<Course[]>(getCourses())
  const [editing, setEditing] = useState<Course | null>(null)
  const [error, setError] = useState<string>('')

  function refresh() {
    setCourses(getCourses())
  }

  function startNew() {
    setError('')
    setEditing(emptyCourse())
  }

  function startEdit(course: Course) {
    setError('')
    setEditing(structuredClone(course))
  }

  function handleDelete(id: string) {
    if (!confirm(t('courses.confirmDelete'))) return
    deleteCourse(id)
    refresh()
  }

  function setHoleCount(count: 9 | 18) {
    if (!editing) return
    // Bahn-HCP wird auf die Ausgangsreihenfolge zurückgesetzt, da die bisherige
    // Verteilung bei einer anderen Lochzahl keine gültige Permutation mehr wäre.
    const holes: HoleInfo[] = Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      par: editing.holes[i]?.par ?? 4,
      strokeIndex: i + 1,
    }))
    setEditing({ ...editing, holeCount: count, holes })
  }

  function updateHolePar(number: number, value: number) {
    if (!editing) return
    setEditing({
      ...editing,
      holes: editing.holes.map((h) => (h.number === number ? { ...h, par: value } : h)),
    })
  }

  // Vertauscht den Bahn-HCP mit der Bahn, die den neuen Wert bisher hatte, damit
  // jeder Wert immer genau einmal vorkommt und die Summe automatisch stimmt.
  function updateHoleStrokeIndex(number: number, newIndex: number) {
    if (!editing) return
    const current = editing.holes.find((h) => h.number === number)
    if (!current) return
    setEditing({
      ...editing,
      holes: editing.holes.map((h) => {
        if (h.number === number) return { ...h, strokeIndex: newIndex }
        if (h.strokeIndex === newIndex) return { ...h, strokeIndex: current.strokeIndex }
        return h
      }),
    })
  }

  function addTee() {
    if (!editing) return
    setEditing({ ...editing, tees: [...editing.tees, emptyTee()] })
  }

  function updateTee(id: string, field: keyof Tee, value: string | number) {
    if (!editing) return
    setEditing({
      ...editing,
      tees: editing.tees.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    })
  }

  function removeTee(id: string) {
    if (!editing) return
    setEditing({ ...editing, tees: editing.tees.filter((t) => t.id !== id) })
  }

  function updateTeeParOverride(teeId: string, holeNumber: number, value: number | undefined) {
    if (!editing) return
    setEditing({
      ...editing,
      tees: editing.tees.map((t) => {
        if (t.id !== teeId) return t
        const parOverrides = { ...t.parOverrides }
        if (value === undefined) delete parOverrides[holeNumber]
        else parOverrides[holeNumber] = value
        return { ...t, parOverrides }
      }),
    })
  }

  function handleSave() {
    if (!editing) return
    if (!editing.name.trim()) {
      setError(t('courses.errorName'))
      return
    }
    if (editing.tees.length === 0) {
      setError(t('courses.errorNoTee'))
      return
    }
    upsertCourse(editing)
    setEditing(null)
    refresh()
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{courses.some((c) => c.id === editing.id) ? t('courses.editTitle') : t('courses.newTitle')}</h2>

        <label className="field">
          <span>{t('courses.name')}</span>
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder={t('courses.namePlaceholder')}
          />
        </label>

        <label className="field">
          <span>{t('courses.holeCount')}</span>
          <select
            value={editing.holeCount}
            onChange={(e) => setHoleCount(Number(e.target.value) as 9 | 18)}
          >
            <option value={18}>18</option>
            <option value={9}>9</option>
          </select>
        </label>

        <h3>{t('courses.tees')}</h3>
        {editing.tees.map((tee) => (
          <div className="tee-row" key={tee.id}>
            <div className="tee-row-main">
              <input
                className="tee-name"
                value={tee.name}
                onChange={(e) => updateTee(tee.id, 'name', e.target.value)}
                placeholder={t('courses.teeNamePlaceholder')}
              />
              <select value={tee.gender} onChange={(e) => updateTee(tee.id, 'gender', e.target.value)}>
                <option value="M">{t('common.men')}</option>
                <option value="W">{t('common.women')}</option>
              </select>
              <button className="icon-btn" onClick={() => removeTee(tee.id)} aria-label={t('courses.removeTee')}>
                ✕
              </button>
            </div>
            <div className="tee-row-details">
              <label className="tee-detail-field">
                <span>{t('courses.courseRating')}</span>
                <DecimalInput
                  value={tee.courseRating}
                  onChange={(value) => updateTee(tee.id, 'courseRating', value)}
                />
              </label>
              <label className="tee-detail-field">
                <span>{t('courses.slope')}</span>
                <DecimalInput
                  decimals={0}
                  value={tee.slope}
                  onChange={(value) => updateTee(tee.id, 'slope', value)}
                />
              </label>
            </div>
          </div>
        ))}
        <button className="secondary" onClick={addTee}>{t('courses.addTee')}</button>

        <h3>{t('courses.holes')} <span className="muted">{t('courses.totalPar', { par: totalPar(editing) })}</span></h3>
        {editing.tees.length > 0 && (
          <p className="hint">{t('courses.parOverrideHint')}</p>
        )}
        <div className="holes-table">
          <div className="holes-header" style={{ gridTemplateColumns: holesGridColumns(editing.tees.length) }}>
            <span>{t('courses.hole')}</span>
            <span>{t('courses.par')}</span>
            {editing.tees.map((tee) => (
              <span key={tee.id}>{tee.name || t('courses.teeFallback')}</span>
            ))}
            <span>{t('courses.strokeIndex')}</span>
          </div>
          {editing.holes.map((hole) => (
            <div
              className="holes-row"
              key={hole.number}
              style={{ gridTemplateColumns: holesGridColumns(editing.tees.length) }}
            >
              <span>{hole.number}</span>
              <DecimalInput
                decimals={0}
                value={hole.par}
                onChange={(value) => updateHolePar(hole.number, value)}
              />
              {editing.tees.map((tee) => (
                <OptionalIntInput
                  key={tee.id}
                  value={tee.parOverrides?.[hole.number]}
                  onChange={(value) => updateTeeParOverride(tee.id, hole.number, value)}
                  placeholder={String(hole.par)}
                />
              ))}
              <select
                value={hole.strokeIndex}
                onChange={(e) => updateHoleStrokeIndex(hole.number, Number(e.target.value))}
              >
                {Array.from({ length: editing.holeCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

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
      <h2>{t('courses.title')}</h2>
      {courses.length === 0 && <p className="hint">{t('courses.empty')}</p>}
      <ul className="list">
        {courses.map((course) => (
          <li key={course.id} className="list-item">
            <div>
              <strong>{course.name}</strong>
              <div className="muted">
                {t('courses.summary', { holes: course.holeCount, par: totalPar(course), tees: course.tees.length })}
              </div>
            </div>
            <div className="list-actions">
              <button className="secondary" onClick={() => startEdit(course)}>{t('common.edit')}</button>
              <button className="danger" onClick={() => handleDelete(course.id)}>{t('common.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={startNew}>{t('courses.addNew')}</button>
    </div>
  )
}
