import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";
import type { Env } from "../env.js";

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

export function createSupabaseClient(env: Env): SupabaseClient {
    return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
}