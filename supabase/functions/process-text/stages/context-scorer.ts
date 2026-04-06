import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 6: Phase 2 — Context Scoring
// Assigns a context_score (0–1) to each token representing how safe it is to
// introduce that word as an i+1 replacement. High scores indicate the word is
// predictable from context (function words); low scores indicate content words
// that carry more meaning and are better teaching targets.
//
// MVP: POS lookup → category fallback → unknown default.
// The MVP tokenizer always produces pos='unknown', so the CATEGORY_FALLBACK
// branch is the primary path for now.

export class CategoryContextScorer {
  score(tokens: Token[]): Token[] {
    return tokens.map((token) => ({
      ...token,
      context_score: this.#scoreToken(token),
    }))
  }

  #scoreToken(token: Token): number {
    if (!token.is_word) return 0

    const posScore = PIPELINE_CONFIG.POS_CONTEXT_SCORES[token.pos]
    if (posScore !== undefined) return posScore

    if (token.category != null) {
      const catScore = PIPELINE_CONFIG.CATEGORY_FALLBACK[token.category]
      if (catScore !== undefined) return catScore
    }

    return PIPELINE_CONFIG.POS_CONTEXT_SCORES['unknown']
  }
}
