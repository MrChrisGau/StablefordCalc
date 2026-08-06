import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

let authPromise: Promise<void> | null = null

// Wiederkehrende Geräte behalten ihre anonyme Identität (wichtig für Slot-Claims
// in Live-Runden); nur ohne bestehende Session wird eine neue angelegt.
export function ensureAuth(): Promise<void> {
  if (!authPromise) {
    authPromise = supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) return
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
    })
  }
  return authPromise
}

export async function getUserId(): Promise<string> {
  await ensureAuth()
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Keine Supabase-Session vorhanden')
  return data.session.user.id
}
