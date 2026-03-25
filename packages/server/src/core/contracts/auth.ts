export interface AuthUser {
  id: string
  email: string | null
  provider?: string
  providers?: string[]
  userMetadata?: Record<string, unknown>
  appMetadata?: Record<string, unknown>
}

export interface ProviderSession {
  accessToken: string
  refreshToken: string
  expiresAt: number // unix seconds
  providerSessionId?: string
}

export interface AuthProvider {
  getAuthorizationUrl(params: {
    redirectTo: string
    state: string
    codeChallenge: string
  }): Promise<string>

  exchangeCode(params: {
    code: string
    codeVerifier: string
    redirectTo: string
  }): Promise<{ user: AuthUser; session: ProviderSession }>

  refreshSession(params: { refreshToken: string }): Promise<ProviderSession>

  getUser(params: { accessToken: string }): Promise<AuthUser>

  signOut(params: { accessToken: string }): Promise<void>
}

export interface AuthContext {
  userId: string
  email: string
  providerSessionId?: string
  accessToken: string
}

export function requireEmail(email: string | null | undefined): string {
  if (!email) throw new Error('Auth user missing email')
  return email
}

