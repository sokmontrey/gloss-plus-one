import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 7: Phase 2 — i+1 Selection
// Selects up to max_new_words tokens to introduce as new L2 words.
//
// Eligibility:
//   - has a target_lemma_id (translatable)
//   - not already is_known (not above replacement threshold)
//   - context_score >= CONTEXT_FLOOR (predictable enough from context)
//   - effective_score < REPLACEMENT_THRESHOLD (not yet known)
//
// Ranking: sort DESCENDING by context_score.
// High context score = word is predictable from surrounding context = user can
// infer meaning = safe to introduce as i+1. Low context score = content word
// carrying unique meaning = harder to infer, not appropriate for first exposure.
//
// Deduplication: if the same target lemma appears multiple times, only the
// instance with the highest context_score is eligible.

export class TopNSelector {
  select(tokens: Token[], maxNew: number): Token[] {
    const candidates: Array<{ index: number; token: Token }> = []
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      if (
        t.is_word &&
        t.target_lemma_id != null &&
        !t.is_known &&
        t.context_score >= PIPELINE_CONFIG.CONTEXT_FLOOR &&
        t.effective_score < PIPELINE_CONFIG.REPLACEMENT_THRESHOLD
      ) {
        candidates.push({ index: i, token: t })
      }
    }

    // Deduplicate by target_lemma_id: keep the instance with highest context_score
    const bestByLemma = new Map<string, { index: number; token: Token }>()
    for (const c of candidates) {
      const existing = bestByLemma.get(c.token.target_lemma_id!)
      if (!existing || c.token.context_score > existing.token.context_score) {
        bestByLemma.set(c.token.target_lemma_id!, c)
      }
    }

    // Sort DESCENDING: highest context score first (safest introductions first)
    const ranked = [...bestByLemma.values()].sort(
      (a, b) => b.token.context_score - a.token.context_score,
    )

    const selectedIndices = new Set(ranked.slice(0, maxNew).map((c) => c.index))

    return tokens.map((token, i) => ({
      ...token,
      is_new_l2: selectedIndices.has(i),
    }))
  }
}
