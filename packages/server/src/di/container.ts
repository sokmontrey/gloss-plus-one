import type { AuthProvider, ProfileRepository, SessionStore } from '../core/contracts/index.js'
import { getConfig } from '../core/config/config.js'
import { SupabaseAuthProvider } from '../adapters/auth/supabase/supabase-auth-provider.js'
import { MemorySessionStore } from '../adapters/session/memory/memory-session-store.js'
import { SupabaseProfileRepository } from '../adapters/profile/supabase/supabase-profile-repository.js'
import { ProfileService } from '../features/profile/profile-service.js'
import { AuthService } from '../features/auth/auth-service.js'
import { OAuthTransactionStore } from '../features/auth/oauth-store.js'
import { AuthController } from '../features/auth/auth-controller.js'
import { buildAuthRoutes } from '../features/auth/auth-routes.js'
import { createRequireAuth } from '../core/http/middleware.js'

export interface Container {
  authProvider: AuthProvider
  sessionStore: SessionStore
  profileRepository: ProfileRepository
  profileService: ProfileService
  authService: AuthService
  authController: AuthController
  authRoutes: import('express').Router
  requireAuth: ReturnType<typeof createRequireAuth>
}

let singleton: Container | null = null

export function getContainer(): Container {
  if (singleton) return singleton

  const config = getConfig()

  const authProvider = new SupabaseAuthProvider(config)

  const sessionStore = new MemorySessionStore()
  const profileRepository = new SupabaseProfileRepository(config)
  const profileService = new ProfileService(profileRepository)
  const oauthTransactions = new OAuthTransactionStore(config.auth.oauthTempTtlSeconds)
  const authService = new AuthService(config, authProvider, sessionStore, oauthTransactions, profileService)
  const requireAuth = createRequireAuth(authService)
  const authController = new AuthController(authService)
  const authRoutes = buildAuthRoutes({ controller: authController, requireAuth })

  singleton = {
    authProvider,
    sessionStore,
    profileRepository,
    profileService,
    authService,
    authController,
    authRoutes,
    requireAuth,
  }

  return singleton
}

export const createContainer = getContainer
