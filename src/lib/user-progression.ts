/**
 * Mirrors `public.user_progressions` (1:1 with auth.users).
 * NULL means use service default (env) until the replace-pipeline reads this row.
 */
export type UserProgression = {
  user_id: string
  min_combined_confidence: number | null
  created_at: string
  updated_at: string
}
