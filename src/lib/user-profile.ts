import type { Session, SupabaseClient } from '@supabase/supabase-js'

/** Default `user_profiles.target_language` (matches DB default + signup trigger). */
export const DEFAULT_TARGET_LANGUAGE = 'es' as const

export type UserProfile = {
  user_id: string
  email: string
  name: string | null
  target_language: string | null
  created_at: string
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

/**
 * Loads `user_profiles` for the session user. If missing (trigger lag / legacy),
 * inserts a row the user may INSERT under RLS, then returns it.
 */
export async function loadUserProfileWithEnsure(
  supabase: SupabaseClient,
  session: Session,
): Promise<UserProfile> {
  const userId = session.user.id

  const { data: existing, error: selectError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing as UserProfile

  const meta = session.user.user_metadata ?? {}
  const row = {
    user_id: userId,
    email: session.user.email ?? '',
    name: trimToNull(meta.full_name ?? meta.name),
    target_language: DEFAULT_TARGET_LANGUAGE,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .insert(row)
    .select()
    .single()

  if (!insertError) return inserted as UserProfile

  if (insertError.code === '23505') {
    const { data: retry, error: retryError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (retryError) throw retryError
    return retry as UserProfile
  }

  throw insertError
}
