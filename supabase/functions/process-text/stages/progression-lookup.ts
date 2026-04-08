import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Token, ProgressionRow } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 4: Progression Lookup & Decay
// Fetches user_progression rows for all target lemmas found in Stage 3,
// then applies the forgetting-curve decay formula to produce effective_score.
//
// For lemmas with no user_progression row, queries language_pair_scores for
// a language-pair-specific base_score (e.g. cognates start higher). Falls
// back to SCORE_FLOOR if no base_score row exists either.
//
// Decay formula:
//   stability  = log2(exposure_count + 1)
//   days_since = ms_since_last_seen / 86_400_000
//   half_lives = days_since / (stability * BASE_HALFLIFE_DAYS)   (stability > 0)
//              = days_since / BASE_HALFLIFE_DAYS                 (first exposure)
//   effective  = max(raw_score * 0.5^half_lives, SCORE_FLOOR)
//
// last_seen_at is nullable (null until the user has actually seen the word
// after the row was created). If null, no decay is applied and raw_score
// is used directly.

export class DbProgressionLookup {
  constructor(private readonly supabase: SupabaseClient) {}

  async lookup(
    tokens: Token[],
    userId: string,
    sourceLangId: string,
    targetLangId: string,
  ): Promise<Token[]> {
    const targetIds = [
      ...new Set(
        tokens.filter((t) => t.target_lemma_id != null).map((t) => t.target_lemma_id!),
      ),
    ]

    if (targetIds.length === 0) return tokens

    const { data, error } = await this.supabase
      .from('user_progression')
      .select('lemma_id, progression_score, exposure_count, last_seen_at')
      .eq('user_id', userId)
      .in('lemma_id', targetIds)

    if (error) {
      console.error('[process-text] progression-lookup DB error:', error.message)
      return tokens
    }

    const rows = (data ?? []) as ProgressionRow[]
    const byLemmaId = new Map<string, ProgressionRow>()
    for (const row of rows) {
      byLemmaId.set(row.lemma_id, row)
    }

    // Fetch base scores for lemmas the user hasn't encountered yet
    const unseenIds = targetIds.filter((id) => !byLemmaId.has(id))
    const baseScoreById = new Map<string, number>()

    if (unseenIds.length > 0) {
      const { data: baseData, error: baseError } = await this.supabase
        .from('language_pair_scores')
        .select('target_lemma_id, base_score')
        .eq('source_language_id', sourceLangId)
        .eq('target_language_id', targetLangId)
        .in('target_lemma_id', unseenIds)

      if (baseError) {
        console.error('[process-text] base-score lookup error:', baseError.message)
      } else {
        for (const row of (baseData ?? []) as Array<{ target_lemma_id: string; base_score: number }>) {
          baseScoreById.set(row.target_lemma_id, Number(row.base_score))
        }
      }
    }

    const now = Date.now()

    return tokens.map((token) => {
      if (!token.target_lemma_id) return token

      const row = byLemmaId.get(token.target_lemma_id)

      if (!row) {
        // Unseen lemma: use language-pair base score, or floor if none seeded
        const baseScore = baseScoreById.get(token.target_lemma_id) ?? PIPELINE_CONFIG.SCORE_FLOOR
        return { ...token, effective_score: baseScore }
      }

      const rawScore = Number(row.progression_score)

      // last_seen_at is null when the row exists but the user hasn't seen it yet —
      // no decay to apply, use raw score directly.
      if (!row.last_seen_at) {
        return { ...token, effective_score: Math.max(rawScore, PIPELINE_CONFIG.SCORE_FLOOR) }
      }

      const daysSince = (now - new Date(row.last_seen_at).getTime()) / 86_400_000
      const stability = Math.log2(row.exposure_count + 1)
      const halfLives = stability > 0
        ? daysSince / (stability * PIPELINE_CONFIG.BASE_HALFLIFE_DAYS)
        : daysSince / PIPELINE_CONFIG.BASE_HALFLIFE_DAYS

      const effectiveScore = Math.max(
        rawScore * Math.pow(0.5, halfLives),
        PIPELINE_CONFIG.SCORE_FLOOR,
      )

      return { ...token, effective_score: effectiveScore }
    })
  }
}
