import PocketBase, { ClientResponseError } from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
// Parallele gleichartige Anfragen (Polling + Realtime) dürfen sich nicht gegenseitig abbrechen.
pb.autoCancellation(false)

const DEVICE_KEY = 'stableford:pbDevice'

interface DeviceCredentials {
  email: string
  password: string
}

function loadDevice(): DeviceCredentials | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    return raw ? (JSON.parse(raw) as DeviceCredentials) : null
  } catch {
    return null
  }
}

function saveDevice(creds: DeviceCredentials) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify(creds))
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 0
}

async function registerDevice(): Promise<void> {
  const email = `d-${crypto.randomUUID()}@device.invalid`
  const password = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
  await pb.collection('users').create({ email, password, passwordConfirm: password })
  saveDevice({ email, password })
  await pb.collection('users').authWithPassword(email, password)
}

// Jedes Gerät behält seine anonyme Identität (wichtig für Slot-Claims in Live-Runden):
// Zugangsdaten liegen zufällig erzeugt im localStorage. Nur ohne gültige Identität
// wird eine neue angelegt.
async function authenticate(): Promise<void> {
  if (pb.authStore.isValid) {
    try {
      await pb.collection('users').authRefresh()
      return
    } catch (error) {
      if (isNetworkError(error)) return // offline: vorhandenes Token weiterverwenden
      pb.authStore.clear()
    }
  }
  const creds = loadDevice()
  if (creds) {
    try {
      await pb.collection('users').authWithPassword(creds.email, creds.password)
      return
    } catch (error) {
      if (isNetworkError(error)) throw error
      // Zugang dem Server unbekannt (z.B. Datenbank neu aufgesetzt): neue Identität anlegen.
    }
  }
  await registerDevice()
}

let authPromise: Promise<void> | null = null

export function ensureAuth(): Promise<void> {
  if (!authPromise) {
    authPromise = authenticate().catch((error) => {
      authPromise = null // beim nächsten Aufruf erneut versuchen (z.B. wieder online)
      throw error
    })
  }
  return authPromise
}

export async function getUserId(): Promise<string> {
  await ensureAuth()
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Keine PocketBase-Anmeldung vorhanden')
  return id
}
