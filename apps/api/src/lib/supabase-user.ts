import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";

/**
 * PostgREST client scoped to one user: anon key + `Authorization: Bearer <accessToken>`.
 * RLS on `public.user_profiles` applies (`auth.uid()`); do not use the service role key here.
 */
export type SupabaseUserClientConfig = {
    url: string;
    publishableKey: string;
    accessToken: string;
};

export type SupabaseUserClient = ReturnType<typeof createClient<Database>>;

export function createSupabaseUserClient(config: SupabaseUserClientConfig): SupabaseUserClient {
    return createClient<Database>(config.url, config.publishableKey, {
        global: {
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
        },
    });
}
