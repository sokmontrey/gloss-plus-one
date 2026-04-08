import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 6: Phase 2 — Context Scoring
// Assigns a context_score (0–1) to each token representing how predictable it
// is from surrounding context. High = safe to introduce (user can infer meaning).
// Low = content word carrying unique meaning (harder to recover from context).
//
// maskedIndices: positions of tokens already replaced in phase 1 (known_l2).
// The MVP heuristic (POS/category) is context-independent so maskedIndices is
// accepted but not used. Future ML-based scorers (mask-fill, attention) need it
// to know which positions are already L2 before scoring remaining candidates.
//
// Only tokens with a target_lemma_id get a meaningful score — tokens with no
// translation can never be selected as i+1 candidates, so scoring them is
// meaningless and could make untranslatable words appear eligible.
//
// Score lookup chain: POS map → category fallback → 0.15 (unknown default).
// The MVP tokenizer always produces pos='unknown', so the primary path is the
// category fallback from the lemmas table. Tokens that had no lemmas match
// have category: null and fall to the unknown default — correctly scoring them
// low and keeping them out of the i+1 candidate pool.

export class CategoryContextScorer {
  score(tokens: Token[], _maskedIndices: number[]): Token[] {
    return tokens.map((token) => ({
      ...token,
      context_score: this.#scoreToken(token),
    }))
  }

  #scoreToken(token: Token): number {
    if (!token.is_word) return 0

    // No translation = can never be an i+1 candidate; score 0 to exclude it cleanly
    if (!token.target_lemma_id) return 0

    // Use POS score only when real POS tagging is wired in.
    // MVP tokenizer emits pos='unknown', which IS a key in POS_CONTEXT_SCORES (0.15),
    // so we must skip the map lookup for 'unknown' — otherwise the category fallback
    // (the primary MVP path) is never reached.
    if (token.pos !== 'unknown') {
      const posScore = PIPELINE_CONFIG.POS_CONTEXT_SCORES[token.pos]
      if (posScore !== undefined) return posScore
    }

    // MVP primary path: category from lemmas table ('function' → 0.90, 'content' → 0.25)
    if (token.category != null) {
      const catScore = PIPELINE_CONFIG.CATEGORY_FALLBACK[token.category]
      if (catScore !== undefined) return catScore
    }

    return PIPELINE_CONFIG.POS_CONTEXT_SCORES['unknown']
  }
}
