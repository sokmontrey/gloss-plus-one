import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

export const GOOGLE_SIGN_IN_MESSAGE = 'gloss-plus-one:google-sign-in'

export async function requestGoogleOAuthUrl(
  supabase: SupabaseClient,
  redirectTo: string,
): Promise<string> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error || !data.url) throw error ?? new Error('Failed to get OAuth URL')
  return data.url
}

export async function completeOAuthRedirect(
  supabase: SupabaseClient,
  responseUrl: string,
): Promise<void> {
  const url = new URL(responseUrl)
  const code = url.searchParams.get('code')
  const hash = new URLSearchParams(url.hash.slice(1))
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError
    return
  }

  if (accessToken && refreshToken) {
    const { error: setError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (setError) throw setError
    return
  }

  const reason =
    url.searchParams.get('error_description') ??
    hash.get('error_description') ??
    url.searchParams.get('error') ??
    hash.get('error') ??
    'Unknown error'
  throw new Error(`OAuth failed: ${reason}`)
}

/**
 * Drops the globally persisted session via API, then always clears chrome.storage.
 * Needed when revoke fails (deleted user / invalid tokens) — local clear still signs the client out.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase.auth.signOut()
  if (error) console.warn('[gloss+1] sign-out:', error.message)

  const { error: localOnly } = await supabase.auth.signOut({ scope: 'local' })
  if (localOnly) console.warn('[gloss+1] local sign-out:', localOnly.message)
}

/** Storage-only logout (no server revoke). Recovery path for orphaned sessions. */
export async function clearLocalAuthSession(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) console.warn('[gloss+1] clear local session:', error.message)
}
