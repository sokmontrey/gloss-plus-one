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

  // Exchange the auth code for a session (PKCE verifier is in chrome.storage from step above).
  const code = new URL(responseUrl).searchParams.get('code')
  if (!code) throw new Error('No auth code in redirect URL')

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) throw exchangeError
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut()
}
