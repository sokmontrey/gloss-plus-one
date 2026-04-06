import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 8: Progression Update
// Upserts user_progression rows for all tokens that were shown to the user.
//
// Two separate upsert calls with different score bumps:
//   - known_l2 (phase 1 replacements): small REINFORCEMENT_BUMP
//   - new_l2 (i+1 introductions): larger I1_INTRODUCTION_BUMP
//
// Score strategy: use the token's effective_score (post-decay) + bump as the
// new progression_score. This is the correct value for both new rows and
// conflicts, since effective_score reflects the user's current actual state.
//
// The service-role client bypasses RLS so the edge function can write
// progression rows on behalf of the authenticated user.

export class DbProgressionUpdater {
  constructor(private readonly supabase: SupabaseClient) {}

  async update(tokens: Token[], userId: string): Promise<void> {
    const knownTokens = tokens.filter((t) => t.is_known && t.target_lemma_id)
    const newTokens = tokens.filter((t) => t.is_new_l2 && t.target_lemma_id)

    await Promise.all([
      this.#upsertBatch(userId, knownTokens, PIPELINE_CONFIG.REINFORCEMENT_BUMP),
      this.#upsertBatch(userId, newTokens, PIPELINE_CONFIG.I1_INTRODUCTION_BUMP),
    ])
  }

  async #upsertBatch(userId: string, tokens: Token[], bump: number): Promise<void> {
    if (tokens.length === 0) return

    const now = new Date().toISOString()
    const rows = tokens.map((t) => ({
      user_id: userId,
      lemma_id: t.target_lemma_id!,
      progression_score: Math.min(t.effective_score + bump, 1),
      exposure_count: 1,           // for new rows; conflicts increment via DO UPDATE
      last_seen_at: now,
    }))

    const { error } = await this.supabase
      .from('user_progression')
      .upsert(rows, { onConflict: 'user_id,lemma_id', ignoreDuplicates: false })

    if (error) {
      console.error('[process-text] progression-updater upsert error:', error.message)
    }
  }
}
