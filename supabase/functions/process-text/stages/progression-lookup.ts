import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Token, ProgressionRow } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 4: Progression Lookup & Decay
// Fetches user_progression rows for all target lemmas encountered in Stage 3,
// then applies the forgetting-curve decay formula to produce effective_score.
//
// Decay formula:
//   stability  = log2(exposure_count + 1)
//   days_since = ms_since_last_seen / 86_400_000
//   half_lives = days_since / (stability * BASE_HALFLIFE_DAYS)   (stability > 0)
//              = days_since / BASE_HALFLIFE_DAYS                 (first exposure)
//   effective  = max(raw_score * 0.5^half_lives, SCORE_FLOOR)

export class DbProgressionLookup {
  constructor(private readonly supabase: SupabaseClient) {}

  async lookup(tokens: Token[], userId: string): Promise<Token[]> {
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

    const now = Date.now()

    return tokens.map((token) => {
      if (!token.target_lemma_id) return token

      const row = byLemmaId.get(token.target_lemma_id)
      if (!row) {
        return { ...token, effective_score: PIPELINE_CONFIG.SCORE_FLOOR }
      }

      const rawScore = Number(row.progression_score)
      const exposureCount = row.exposure_count
      const lastSeenMs = new Date(row.last_seen_at).getTime()
      const daysSince = (now - lastSeenMs) / 86_400_000

      const stability = Math.log2(exposureCount + 1)
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
