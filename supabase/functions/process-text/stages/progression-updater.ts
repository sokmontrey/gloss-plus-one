import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 8: Progression Update
// Calls the upsert_progression RPC (SECURITY DEFINER) which handles
// exposure_count incrementing server-side. PostgREST upsert cannot express
// `exposure_count + 1` — it would overwrite with 1 on every conflict.
//
// Two RPC calls per request: one for known_l2 reinforcement, one for new_l2
// introductions. Each call is a single batched unnest() insert.
//
// Deduplication: if the same lemma appears multiple times in the token list
// (e.g., "the" 5 times), keep only the highest effective_score instance to
// avoid sending duplicate user_id + lemma_id pairs which would cause errors.

export class DbProgressionUpdater {
  constructor(private readonly supabase: SupabaseClient) {}

  async update(tokens: Token[], userId: string): Promise<void> {
    const knownTokens = tokens.filter((t) => t.is_known && t.target_lemma_id)
    const newTokens = tokens.filter((t) => t.is_new_l2 && t.target_lemma_id)
    // Words seen before (score > floor) but not yet known and not budget-selected:
    // bump passively so they progress toward the threshold even when losing the
    // top-N lottery. EXPOSURE_BUMP is smaller than the introduction bump to keep
    // the new_l2 selection the primary driver of early progression.
    const passiveTokens = tokens.filter((t) =>
      t.is_word &&
      t.target_lemma_id &&
      !t.is_known &&
      !t.is_new_l2 &&
      t.effective_score > PIPELINE_CONFIG.SCORE_FLOOR
    )

    await Promise.all([
      this.#upsertBatch(userId, knownTokens, PIPELINE_CONFIG.REINFORCEMENT_BUMP),
      this.#upsertBatch(userId, newTokens, PIPELINE_CONFIG.I1_INTRODUCTION_BUMP),
      this.#upsertBatch(userId, passiveTokens, PIPELINE_CONFIG.EXPOSURE_BUMP),
    ])
  }

  async #upsertBatch(userId: string, tokens: Token[], bump: number): Promise<void> {
    if (tokens.length === 0) return

    // Deduplicate by target_lemma_id — keep highest effective_score per lemma
    const deduped = new Map<string, Token>()
    for (const t of tokens) {
      const existing = deduped.get(t.target_lemma_id!)
      if (!existing || t.effective_score > existing.effective_score) {
        deduped.set(t.target_lemma_id!, t)
      }
    }

    const lemmaIds: string[] = []
    const scores: number[] = []
    for (const [id, t] of deduped) {
      lemmaIds.push(id)
      scores.push(Math.min(t.effective_score + bump, 1))
    }

    const { error } = await this.supabase.rpc('upsert_progression', {
      p_user_id: userId,
      p_lemma_ids: lemmaIds,
      p_scores: scores,
      p_bump: bump,
    })

    if (error) {
      console.error('[process-text] progression-updater RPC error:', error.message)
    }
  }
}
