import * as dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  APP_URL: z.string().url(),
  API_URL: z.string().url(),

  EXTENSION_ORIGIN: z.string().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  SESSION_COOKIE_NAME: z.string().default('gpo.sid'),
  SESSION_COOKIE_SECRET: z.string().min(16),
  PROFILE_TABLE: z.string().default('profiles'),
  OAUTH_TEMP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  ACCESS_TOKEN_REFRESH_SKEW_SECONDS: z.coerce.number().int().nonnegative().default(60),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(): Env {
  return EnvSchema.parse(process.env)
}

