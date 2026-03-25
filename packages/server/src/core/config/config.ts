import { loadEnv } from './env.js'

export type RuntimeConfig = ReturnType<typeof loadConfig>
export type AppConfig = RuntimeConfig

export function loadConfig() {
  const env = loadEnv()

  const corsOrigin = env.EXTENSION_ORIGIN ?? env.APP_URL

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,

    appUrl: env.APP_URL,
    apiUrl: env.API_URL,

    corsOrigin,

    supabase: {
      url: env.SUPABASE_URL,
      publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },

    cookie: {
      name: env.SESSION_COOKIE_NAME,
      secret: env.SESSION_COOKIE_SECRET,
      secure: env.NODE_ENV === 'production',
    },

    auth: {
      oauthTempTtlSeconds: env.OAUTH_TEMP_TTL_SECONDS,
      accessTokenRefreshSkewSeconds: env.ACCESS_TOKEN_REFRESH_SKEW_SECONDS,
    },

    profile: {
      table: env.PROFILE_TABLE,
    },
  }
}

export function getConfig() {
  // For now, load once per process. If you need per-request config, pass it explicitly.
  return loadConfig()
}

