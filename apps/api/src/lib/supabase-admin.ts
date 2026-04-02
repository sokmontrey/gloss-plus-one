import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";

/**
 * Supabase PostgREST client using the **service role** key (`SUPABASE_SECRET_KEY`).
 * Server-only, bypasses RLS. Optional: scripts, migrations, or future admin tooling —
 * routine `user_profiles` access in apps/api uses {@link createSupabaseUserClient} + user JWT.
 *
 * Auth (`exchangeCodeForSession`, `getUser`, admin sign-out) is handled in `adapters/supabase-auth.ts`.
 */
export type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

export type SupabaseAdminConfig = {
    url: string;
    /** Service role secret — never send to browsers or embed in clients. */
    serviceRoleKey: string;
};

export function createSupabaseAdminClient(
    config: SupabaseAdminConfig,
): SupabaseAdminClient {
    return createClient<Database>(config.url, config.serviceRoleKey);
}
