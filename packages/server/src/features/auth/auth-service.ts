import { HttpError } from '../../core/http/errors.js'
import type { AuthProvider, SessionData, SessionStore } from '../../core/contracts/index.js'
import { requireEmail } from '../../core/contracts/index.js'
import type { RuntimeConfig } from '../../core/config/config.js'
import type { OAuthTransactionStore } from './oauth-store.js'
import type { ProfileService } from '../profile/profile-service.js'

export class AuthService {
  private readonly refreshLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly config: RuntimeConfig,
    private readonly authProvider: AuthProvider,
    private readonly sessionStore: SessionStore,
    private readonly oauthTransactions: OAuthTransactionStore,
    private readonly profileService: ProfileService
  ) {}

  async beginGoogleAuth(returnTo?: string) {
    const tx = this.oauthTransactions.create(returnTo)
    const url = await this.authProvider.getAuthorizationUrl({
      redirectTo: `${this.config.apiUrl}/auth/callback`,
      state: tx.state,
      codeChallenge: tx.codeChallenge,
    })
    return { authorizationUrl: url }
  }

  async completeGoogleAuth(params: { code?: string; state?: string }) {
    const code = params.code
    const state = params.state
    if (!code || !state) {
      throw new HttpError(400, 'Missing OAuth callback params')
    }

    const tx = this.oauthTransactions.consume(state)
    if (!tx) {
      throw new HttpError(400, 'Invalid or expired OAuth state')
    }

    const { user, session } = await this.authProvider.exchangeCode({
      code,
      codeVerifier: tx.codeVerifier,
      redirectTo: `${this.config.apiUrl}/auth/callback`,
    })

    await this.profileService.upsertFromAuthUser(user)

    const sid = await this.sessionStore.create(this.toSessionData(user, session))

    return {
      redirectTo: tx.returnTo ?? this.config.appUrl,
      cookie: {
        name: this.cookieName,
        value: sid,
        options: {
          ...this.cookieBaseOptions,
          signed: true,
          maxAge: 1000 * 60 * 60 * 24 * 30,
        } as const,
      },
    }
  }

  get cookieName() {
    return this.config.cookie.name
  }

  get cookieBaseOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.cookie.secure,
      path: '/',
    }
  }

  get cookieClearOptions() {
    return this.cookieBaseOptions
  }

  async resolveAuthContextBySid(sid: string | undefined | null) {
    if (!sid) throw new HttpError(401, 'Unauthorized')

    const session = await this.sessionStore.get(sid)
    if (!session) throw new HttpError(401, 'Unauthorized')

    await this.refreshIfNeeded(sid, session)
    const latest = (await this.sessionStore.get(sid)) ?? session

    return {
      userId: latest.userId,
      email: requireEmail(latest.email),
      providerSessionId: latest.providerSessionId,
      accessToken: latest.accessToken,
      sid,
    }
  }

  async logout(sid: string | undefined | null) {
    if (!sid) return
    const session = await this.sessionStore.get(sid)
    if (session) {
      await this.authProvider.signOut({ accessToken: session.accessToken }).catch(() => undefined)
    }
    await this.sessionStore.delete(sid)
  }

  private async refreshIfNeeded(sid: string, session: SessionData) {
    const skew = this.config.auth.accessTokenRefreshSkewSeconds
    const now = Math.floor(Date.now() / 1000)
    const isExpiring = session.expiresAt - skew <= now
    if (!isExpiring) return

    const existingLock = this.refreshLocks.get(sid)
    if (existingLock) {
      await existingLock
      return
    }

    const refreshPromise = this.performRefresh(sid).finally(() => {
      this.refreshLocks.delete(sid)
    })

    this.refreshLocks.set(sid, refreshPromise)
    await refreshPromise
  }

  private async performRefresh(sid: string) {
    const current = await this.sessionStore.get(sid)
    if (!current) throw new HttpError(401, 'Unauthorized')

    try {
      const refreshed = await this.authProvider.refreshSession({
        refreshToken: current.refreshToken,
      })

      await this.sessionStore.update(sid, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || current.refreshToken,
        expiresAt: refreshed.expiresAt,
        providerSessionId: refreshed.providerSessionId ?? current.providerSessionId,
      })
    } catch {
      await this.sessionStore.delete(sid)
      throw new HttpError(401, 'Session expired')
    }
  }

  private toSessionData(
    user: { id: string; email: string | null },
    session: { accessToken: string; refreshToken: string; expiresAt: number; providerSessionId?: string }
  ): SessionData {
    const now = Math.floor(Date.now() / 1000)
    return {
      userId: user.id,
      email: requireEmail(user.email),
      provider: 'supabase',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      providerSessionId: session.providerSessionId,
      createdAt: now,
      updatedAt: now,
    }
  }
}
