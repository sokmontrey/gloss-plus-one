import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";

/**
 * Supabase PostgREST client using the **service role** key (`SUPABASE_SECRET_KEY`).
 * Server-only: trusted API code (e.g. profile persistence). Not the anon/publishable key.
 *
 * Construct this only in the composition root (`src/index.ts`). Feature routers/services
 * receive a repository that already holds this client — they must not import this module.
 *
 * Auth (`exchangeCodeForSession`, `getUser`, admin sign-out) uses a separate client in
 * `adapters/supabase-auth.ts`, still server-only and still constructed at the composition root.
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
