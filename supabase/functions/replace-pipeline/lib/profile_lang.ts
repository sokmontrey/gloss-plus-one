import type { SupabaseClient } from "@supabase/supabase-js"

/** `user_profiles.target_language` FK → languages; always lower-case in DB migrations. */
export async function fetchUserTargetLanguage(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("target_language")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data?.target_language?.length) return "fr"

  return data.target_language
}
