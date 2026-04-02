import { createClient, type Session, type User } from '@supabase/supabase-js'
import type { AuthProvider, AuthUser, ProviderSession } from '../../../core/contracts/index.js'
import type { RuntimeConfig } from '../../../core/config/config.js'
import { HttpError } from '../../../core/http/errors.js'

function toAuthUser(user: User): AuthUser {
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? undefined
  return {
    id: user.id,
    email: user.email ?? null,
    provider: user.app_metadata?.provider as string | undefined,
    providers,
    userMetadata: (user.user_metadata as Record<string, unknown> | undefined) ?? undefined,
    appMetadata: (user.app_metadata as Record<string, unknown> | undefined) ?? undefined,
  }
}

function toProviderSession(session: Session): ProviderSession {
  if (!session.refresh_token || !session.access_token || !session.expires_at) {
    throw new HttpError(401, 'Invalid provider session response')
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
  }
}

export class SupabaseAuthProvider implements AuthProvider {
  // Used only for refreshSession, which has no PKCE concerns.
  private readonly client = createClient(this.config.supabase.url, this.config.supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  constructor(private readonly config: RuntimeConfig) {}

  // Build the authorization URL directly against the Supabase REST API so we
  // own the full PKCE parameter set. Using supabase-js signInWithOAuth would
  // inject its own code_challenge (generated and stored in browser localStorage)
  // which is unavailable on the server, breaking the exchange step.
  async getAuthorizationUrl(params: {
    redirectTo: string
    state: string
    codeChallenge: string
  }): Promise<string> {
    const url = new URL(`${this.config.supabase.url}/auth/v1/authorize`)
    url.searchParams.set('provider', 'google')
    url.searchParams.set('redirect_to', params.redirectTo)
    url.searchParams.set('state', params.state)
    url.searchParams.set('code_challenge', params.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    return url.toString()
  }

  // Exchange the code via the Supabase REST token endpoint so we can supply
  // the code_verifier that we stored server-side in OAuthTransactionStore.
  // supabase-js exchangeCodeForSession() looks for the verifier in localStorage
  // which does not exist on the server.
  async exchangeCode(params: {
    code: string
    codeVerifier?: string
    redirectTo?: string
  }): Promise<{ user: AuthUser; session: ProviderSession }> {
    const res = await fetch(`${this.config.supabase.url}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.config.supabase.publishableKey,
      },
      body: JSON.stringify({ auth_code: params.code, code_verifier: params.codeVerifier }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      throw new HttpError(401, `OAuth code exchange failed: ${body['error_description'] ?? body['message'] ?? res.statusText}`)
    }

    const data = await res.json() as {
      access_token: string
      refresh_token: string
      expires_at?: number
      token_type: string
      user: User
    }

    if (!data.access_token || !data.refresh_token || !data.user) {
      throw new HttpError(401, 'OAuth code exchange failed: incomplete token response')
    }

    return {
      user: toAuthUser(data.user),
      session: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      },
    }
  }

  async refreshSession(params: { refreshToken: string }): Promise<ProviderSession> {
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: params.refreshToken,
    })

    if (error || !data.session) {
      throw new HttpError(401, `Session refresh failed: ${error?.message ?? 'unknown error'}`)
    }

    return toProviderSession(data.session)
  }
}
