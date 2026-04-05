import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Persists session in chrome.storage.local so it survives popup closes
// and is accessible from the service worker.
const chromeStorage = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((v) => (v[key] as string) ?? null),
  setItem: (key: string, value: string) => chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !key) return null

  client = createClient(url, key, {
    auth: {
      storage: chromeStorage,
      storageKey: getStorageKey(url),
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return client
}

function getStorageKey(url: string): string {
  try {
    const { host } = new URL(url)
    return `gloss-plus-one.auth.${host}`
  } catch {
    return 'gloss-plus-one.auth'
  }
}
