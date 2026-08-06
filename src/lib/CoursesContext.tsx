import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Course } from '../types'
import {
  deleteCourse,
  getCourses,
  getCoursesSyncedOnce,
  saveCourses,
  setCoursesSyncedOnce,
  upsertCourse,
} from '../storage'
import { ensureAuth } from './supabase'
import { fetchCourses, pushCourseDelete, pushCourseUpsert, subscribeToCourseChanges } from './courseSync'

interface CoursesContextValue {
  courses: Course[]
  saveCourse: (course: Course) => void
  removeCourse: (id: string) => void
}

const CoursesContext = createContext<CoursesContextValue | null>(null)

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(() => getCourses())

  useEffect(() => {
    let cancelled = false

    function resync() {
      fetchCourses()
        .then((remote) => {
          if (cancelled) return
          saveCourses(remote)
          setCourses(getCourses())
        })
        .catch((error) => console.error('Platz-Synchronisierung fehlgeschlagen', error))
    }

    // Erster Abgleich auf einem Gerät: lokale Plätze, die noch nie synchronisiert
    // wurden (z.B. von vor Einführung der Synchronisierung), dürfen nicht durch
    // ein leeres oder unvollständiges Remote überschrieben werden — sie werden
    // stattdessen einmalig zu Supabase hochgeladen und mit dem Remote-Stand vereint.
    async function initialSync() {
      const remote = await fetchCourses()
      if (cancelled) return
      if (getCoursesSyncedOnce()) {
        saveCourses(remote)
        setCourses(getCourses())
        return
      }
      const remoteIds = new Set(remote.map((c) => c.id))
      const localOnly = getCourses().filter((c) => !remoteIds.has(c.id))
      if (localOnly.length > 0) {
        await Promise.all(localOnly.map((c) => pushCourseUpsert(c).catch((error) => console.error('Platz-Migration fehlgeschlagen', error))))
      }
      setCoursesSyncedOnce()
      if (cancelled) return
      saveCourses([...remote, ...localOnly])
      setCourses(getCourses())
    }

    ensureAuth()
      .then(initialSync)
      .catch((error) => console.error('Anonyme Anmeldung fehlgeschlagen', error))

    const unsubscribe = subscribeToCourseChanges(resync)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  function saveCourse(course: Course) {
    upsertCourse(course)
    setCourses(getCourses())
    pushCourseUpsert(course).catch((error) => console.error('Platz-Synchronisierung fehlgeschlagen', error))
  }

  function removeCourse(id: string) {
    deleteCourse(id)
    setCourses(getCourses())
    pushCourseDelete(id).catch((error) => console.error('Platz-Synchronisierung fehlgeschlagen', error))
  }

  return <CoursesContext.Provider value={{ courses, saveCourse, removeCourse }}>{children}</CoursesContext.Provider>
}

export function useCourses(): CoursesContextValue {
  const ctx = useContext(CoursesContext)
  if (!ctx) throw new Error('useCourses must be used within CoursesProvider')
  return ctx
}
