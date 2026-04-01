export const GOOGLE_AUTH_PROVIDER = 'google' as const
export type GoogleAuthProvider = typeof GOOGLE_AUTH_PROVIDER

export interface AuthUser {
    id: string
    email: string
    name?: string
    avatarUrl?: string
    provider: GoogleAuthProvider
}

export interface AuthTokens {
    accessToken: string
    refreshToken: string
    expiresAt: number // unix seconds
}

export interface AuthSession {
    user: AuthUser
    tokens: AuthTokens
}

export interface GoogleOAuthUrlParams {
    /** Absolute URL the provider redirects to after consent */
    redirectTo: string
    /** CSRF nonce your route generates and stores in a cookie */
    state?: string
    /** Force account picker even if user has one session */
    prompt?: 'consent' | 'select_account' | 'none'
    /** Pre-fill the email field on the consent screen */
    loginHint?: string
}

export interface GoogleOAuthCallbackParams {
    /** Authorization code from the query string */
    code: string
    /** PKCE verifier if the provider flow uses it */
    codeVerifier?: string
}

export type AuthErrorCode =
    | 'INVALID_TOKEN'
    | 'TOKEN_EXPIRED'
    | 'REFRESH_FAILED'
    | 'OAUTH_FAILED'
    | 'USER_NOT_FOUND'
    | 'PROVIDER_ERROR'

export class AuthError extends Error {
    constructor(
        public readonly code: AuthErrorCode,
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message)
        this.name = 'AuthError'
    }
}

export interface AuthAdapter {
    /**
     * Build the Google consent screen URL.
     * Client redirects the user here to start the OAuth flow.
     * @throws AuthError with code PROVIDER_ERROR
     */
    getGoogleOAuthUrl(params: GoogleOAuthUrlParams): Promise<string>

    /**
     * Exchange the authorization code for a full session.
     * Called from your /auth/callback route.
     * @throws AuthError with code OAUTH_FAILED
     */
    completeGoogleOAuth(params: GoogleOAuthCallbackParams): Promise<AuthSession>

    /**
     * Validate an access token and return the user.
     * Used by auth middleware on every protected request.
     * Returns null for invalid/expired tokens (not an error).
     */
    verifyAccessToken(accessToken: string): Promise<AuthUser | null>

    /**
     * Exchange a refresh token for new credentials.
     * Returns null if the refresh token is revoked or expired.
     * @throws AuthError with code REFRESH_FAILED on provider errors
     */
    refreshSession(refreshToken: string): Promise<AuthSession | null>

    /**
     * Revoke the session server-side. Best-effort, never throws.
     */
    revokeSession(accessToken: string): Promise<void>
}