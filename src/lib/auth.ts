import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

/**
 * OAuth must finish inside `launchWebAuthFlow`.
 * Supabase redirects to `https://<ext-id>.chromiumapp.org/` — that host is synthetic (Chrome only);
 * opening the same URL in a normal tab hits real DNS and fails (DNS_PROBE_POSSIBLE).
 */
async function oauthThroughIdentityWebAuthFlow(authUrl: string): Promise<string> {
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  })
  if (!responseUrl) throw new Error('Sign-in was cancelled')
  return responseUrl
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

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client is not configured')

  const redirectTo = chrome.identity.getRedirectURL()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })

  if (error || !data.url) throw error ?? new Error('Failed to get OAuth URL')

  console.debug('[auth] OAuth URL:', data.url)

  const responseUrl = await oauthThroughIdentityWebAuthFlow(data.url)
  console.debug('[auth] redirect URL:', responseUrl)

  await completeOAuthRedirect(supabase, responseUrl)
}

async function completeOAuthRedirect(supabase: SupabaseClient, responseUrl: string): Promise<void> {
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
