import { getSupabase } from './supabase'

// The redirect URL Chrome intercepts after the user approves the OAuth flow.
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client is not configured')

  // Get the OAuth URL with PKCE. skipBrowserRedirect keeps us in control of the redirect.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  })
  if (error || !data.url) throw error ?? new Error('Failed to get OAuth URL')

  // Paste this URL into a browser tab to see what Supabase returns (useful for debugging).
  console.debug('[auth] OAuth URL:', data.url)

  // Open the Google consent screen and wait for the redirect.
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  })
  if (!responseUrl) throw new Error('Sign-in was cancelled')

  console.debug('[auth] redirect URL:', responseUrl)

  const url = new URL(responseUrl)
  const code = url.searchParams.get('code')
  const hash = new URLSearchParams(url.hash.slice(1))
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')

  if (code) {
    // PKCE flow — exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError
  } else if (accessToken && refreshToken) {
    // Implicit flow — set session directly from tokens in hash fragment
    const { error: setError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (setError) throw setError
  } else {
    const reason =
      url.searchParams.get('error_description') ??
      hash.get('error_description') ??
      url.searchParams.get('error') ??
      hash.get('error') ??
      'Unknown error'
    throw new Error(`OAuth failed: ${reason}`)
  }
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut()
}
