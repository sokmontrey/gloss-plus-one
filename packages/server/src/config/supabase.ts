import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export function createUserClient(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
