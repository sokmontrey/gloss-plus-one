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
    // supabase-js Session type does not currently expose session_id strongly; keep optional.
  }
}

export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly config: RuntimeConfig) {}

  private client() {
    return createClient(this.config.supabase.url, this.config.supabase.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  }

  async getAuthorizationUrl(params: {
    redirectTo: string
    state: string
    codeChallenge: string
  }): Promise<string> {
    const supabase = this.client()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: params.redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          state: params.state,
          code_challenge: params.codeChallenge,
          code_challenge_method: 's256',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error || !data?.url) {
      throw new HttpError(502, `Unable to start Google OAuth: ${error?.message ?? 'missing url'}`)
    }

    return data.url
  }

  async exchangeCode(params: {
    code: string
    codeVerifier?: string
    redirectTo?: string
  }): Promise<{ user: AuthUser; session: ProviderSession }> {
    const supabase = this.client()

    // supabase-js manages PKCE verifier internally when using browser storage.
    // In this server-owned flow, we include PKCE params in the initial authorization URL only,
    // and exchange the code directly here.
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code)
    if (error || !data.session || !data.user) {
      throw new HttpError(401, `OAuth code exchange failed: ${error?.message ?? 'unknown error'}`)
    }

    return {
      user: toAuthUser(data.user),
      session: toProviderSession(data.session),
    }
  }

  async refreshSession(params: { refreshToken: string }): Promise<ProviderSession> {
    const supabase = this.client()
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: params.refreshToken,
    })

    if (error || !data.session) {
      throw new HttpError(401, `Session refresh failed: ${error?.message ?? 'unknown error'}`)
    }

    return toProviderSession(data.session)
  }

  async getUser(params: { accessToken: string }): Promise<AuthUser> {
    const supabase = this.client()
    const { data, error } = await supabase.auth.getUser(params.accessToken)
    if (error || !data.user) {
      throw new HttpError(401, `Unable to fetch user: ${error?.message ?? 'unknown error'}`)
    }

    return toAuthUser(data.user)
  }
}

