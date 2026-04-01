// App auth boundary: types + AuthAdapter only. IdP impls live in apps (e.g. Supabase). Google OAuth only.

export const GOOGLE_AUTH_PROVIDER = 'google' as const
export type GoogleAuthProvider = typeof GOOGLE_AUTH_PROVIDER

export interface AuthUser {
    id: string
    email: string | null
    provider: GoogleAuthProvider
}

// Mapped from whatever backend returns (session/JWT claims).
export interface AuthTokens {
    accessToken: string
    refreshToken?: string
    expiresAt?: number // unix seconds, if known
}

export interface AuthSession {
    user: AuthUser
    tokens: AuthTokens
}

// Callback route: auth code and optional PKCE verifier.
export interface GoogleOAuthCallbackParams {
    code: string
    codeVerifier?: string
}

export interface AuthAdapter {
    // redirectTo = absolute callback URL; state = optional CSRF nonce
    getGoogleOAuthUrl(redirectTo: string, state?: string): Promise<string>

    completeGoogleOAuth(params: GoogleOAuthCallbackParams): Promise<AuthSession>

    verifyAccessToken(accessToken: string): Promise<AuthUser | null>

    refreshSession(refreshToken: string): Promise<AuthTokens | null>

    revokeSession(accessToken: string): Promise<void> // best-effort
}
