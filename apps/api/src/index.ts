import "dotenv/config"

export { env, envSchema, parseEnv, type Env } from "@gloss/env"
export { createSupabaseAuthAdapter, createSupabaseServerClient } from "./auth/adapters/supabase-auth-adapter.js"
export type { SupabaseAuthAdapterConfig } from "./auth/adapters/supabase-auth-adapter.js"
