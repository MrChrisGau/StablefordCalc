import { useState } from 'react'
import type { Course, HoleInfo, Tee } from '../types'
import { deleteCourse, genId, getCourses, upsertCourse } from '../storage'
import { totalPar } from '../stableford'
import DecimalInput from '../components/DecimalInput'

function emptyHoles(count: number): HoleInfo[] {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }))
}

function emptyCourse(): Course {
  return { id: genId(), name: '', holeCount: 18, tees: [], holes: emptyHoles(18) }
}

function emptyTee(): Tee {
  return { id: genId(), name: '', gender: 'M', courseRating: 70, slope: 125 }
}

export default function CoursesPage() {
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
    if (!confirm('Diesen Platz wirklich löschen?')) return
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

  function handleSave() {
    if (!editing) return
    if (!editing.name.trim()) {
      setError('Bitte einen Namen für den Platz angeben.')
      return
    }
    if (editing.tees.length === 0) {
      setError('Bitte mindestens einen Abschlag (Tee) anlegen.')
      return
    }
    upsertCourse(editing)
    setEditing(null)
    refresh()
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{courses.some((c) => c.id === editing.id) ? 'Platz bearbeiten' : 'Neuer Platz'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="z.B. Golfclub Musterstadt"
          />
        </label>

        <label className="field">
          <span>Anzahl Löcher</span>
          <select
            value={editing.holeCount}
            onChange={(e) => setHoleCount(Number(e.target.value) as 9 | 18)}
          >
            <option value={18}>18</option>
            <option value={9}>9</option>
          </select>
        </label>

        <h3>Abschläge</h3>
        {editing.tees.map((tee) => (
          <div className="tee-row" key={tee.id}>
            <div className="tee-row-main">
              <input
                className="tee-name"
                value={tee.name}
                onChange={(e) => updateTee(tee.id, 'name', e.target.value)}
                placeholder="Farbe, z.B. Gelb"
              />
              <select value={tee.gender} onChange={(e) => updateTee(tee.id, 'gender', e.target.value)}>
                <option value="M">Herren</option>
                <option value="W">Damen</option>
              </select>
              <button className="icon-btn" onClick={() => removeTee(tee.id)} aria-label="Abschlag löschen">
                ✕
              </button>
            </div>
            <div className="tee-row-details">
              <label className="tee-detail-field">
                <span>Course Rating</span>
                <DecimalInput
                  value={tee.courseRating}
                  onChange={(value) => updateTee(tee.id, 'courseRating', value)}
                />
              </label>
              <label className="tee-detail-field">
                <span>Slope</span>
                <input
                  type="number"
                  value={tee.slope}
                  onChange={(e) => updateTee(tee.id, 'slope', Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        ))}
        <button className="secondary" onClick={addTee}>+ Abschlag hinzufügen</button>

        <h3>Bahnen <span className="muted">(Gesamt-Par {totalPar(editing)})</span></h3>
        <div className="holes-table">
          <div className="holes-header">
            <span>Bahn</span>
            <span>Par</span>
            <span>Bahn-HCP</span>
          </div>
          {editing.holes.map((hole) => (
            <div className="holes-row" key={hole.number}>
              <span>{hole.number}</span>
              <input
                type="number"
                value={hole.par}
                onChange={(e) => updateHolePar(hole.number, Number(e.target.value))}
              />
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
          <button className="secondary" onClick={() => setEditing(null)}>Abbrechen</button>
          <button className="primary" onClick={handleSave}>Speichern</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>Plätze</h2>
      {courses.length === 0 && <p className="hint">Noch keine Plätze angelegt.</p>}
      <ul className="list">
        {courses.map((course) => (
          <li key={course.id} className="list-item">
            <div>
              <strong>{course.name}</strong>
              <div className="muted">{course.holeCount} Löcher · Par {totalPar(course)} · {course.tees.length} Abschläge</div>
            </div>
            <div className="list-actions">
              <button className="secondary" onClick={() => startEdit(course)}>Bearbeiten</button>
              <button className="danger" onClick={() => handleDelete(course.id)}>Löschen</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={startNew}>+ Neuer Platz</button>
    </div>
  )
}
