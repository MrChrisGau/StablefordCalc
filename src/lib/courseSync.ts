import type { Course } from '../types'
import { supabase } from './supabase'

interface CourseRow {
  id: string
  name: string
  sort_key: string
  hole_count: number
  tees: Course['tees']
  holes: Course['holes']
}

function mapRowToCourse(row: CourseRow): Course {
  return {
    id: row.id,
    name: row.name,
    sortKey: row.sort_key,
    holeCount: row.hole_count as 9 | 18,
    tees: row.tees,
    holes: row.holes,
  }
}

function mapCourseToRow(course: Course): CourseRow {
  return {
    id: course.id,
    name: course.name,
    sort_key: course.sortKey,
    hole_count: course.holeCount,
    tees: course.tees,
    holes: course.holes,
  }
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase.from('courses').select('*')
  if (error) throw error
  return (data as CourseRow[]).map(mapRowToCourse)
}

export function subscribeToCourseChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('courses-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, onChange)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export async function pushCourseUpsert(course: Course): Promise<void> {
  const { error } = await supabase.from('courses').upsert(mapCourseToRow(course))
  if (error) throw error
}

export async function pushCourseDelete(id: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}
