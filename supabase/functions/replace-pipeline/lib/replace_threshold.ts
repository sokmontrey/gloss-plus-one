import type { SupabaseClient } from "@supabase/supabase-js"

/** When `user_progressions.min_combined_confidence` is NULL (matches prior env-less default). */
export const DEFAULT_REPLACE_THRESHOLD = 0.42

/**
 * `user_progressions.min_combined_confidence` when set; else {@link DEFAULT_REPLACE_THRESHOLD}.
 */
export async function resolveReplaceThreshold(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("user_progressions")
    .select("min_combined_confidence")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.warn("[replace-pipeline] user_progressions read failed:", error.message)
    return DEFAULT_REPLACE_THRESHOLD
  }

  const raw = data?.min_combined_confidence as number | string | null | undefined
  if (raw != null && Number.isFinite(Number(raw))) {
    const n = Number(raw)
    return Math.min(Math.max(n, 0), 1)
  }

  return DEFAULT_REPLACE_THRESHOLD
}
