import { ClientResponseError } from 'pocketbase'
import type { Course } from '../types'
import { ensureAuth, pb } from './pocketbase'

interface CourseRecord {
  id: string
  name: string
  sort_key: string
  hole_count: number
  tees: Course['tees']
  holes: Course['holes']
}

function mapRecordToCourse(record: CourseRecord): Course {
  return {
    id: record.id,
    name: record.name,
    sortKey: record.sort_key,
    holeCount: record.hole_count as 9 | 18,
    tees: record.tees,
    holes: record.holes,
  }
}

function mapCourseToFields(course: Course) {
  return {
    name: course.name,
    sort_key: course.sortKey,
    hole_count: course.holeCount,
    tees: course.tees,
    holes: course.holes,
  }
}

export async function fetchCourses(): Promise<Course[]> {
  const records = await pb.collection('courses').getFullList<CourseRecord>()
  return records.map(mapRecordToCourse)
}

export function subscribeToCourseChanges(onChange: () => void): () => void {
  const unsubscribe = pb
    .collection('courses')
    .subscribe('*', onChange)
    .catch((error) => {
      console.error('Platz-Echtzeitverbindung fehlgeschlagen', error)
      return () => {}
    })
  return () => {
    unsubscribe.then((fn) => fn())
  }
}

export async function pushCourseUpsert(course: Course): Promise<void> {
  await ensureAuth()
  const collection = pb.collection('courses')
  try {
    await collection.update(course.id, mapCourseToFields(course))
  } catch (error) {
    if (!(error instanceof ClientResponseError) || error.status !== 404) throw error
    await collection.create({ id: course.id, ...mapCourseToFields(course) })
  }
}

export async function pushCourseDelete(id: string): Promise<void> {
  await ensureAuth()
  try {
    await pb.collection('courses').delete(id)
  } catch (error) {
    if (!(error instanceof ClientResponseError) || error.status !== 404) throw error
  }
}
