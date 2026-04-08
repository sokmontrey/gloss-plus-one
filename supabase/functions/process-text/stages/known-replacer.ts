import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 5: Phase 1 — Known Word Replacement
// Marks tokens as known if their effective_score meets the replacement threshold.
//
// Tokens without a translation (target_lemma_id: null) have effective_score: 0
// from initialization, so 0 >= 0.50 is false and they correctly get
// is_known: false. This is intentional, not accidental.

export class ThresholdReplacer {
  replace(tokens: Token[]): Token[] {
    return tokens.map((token) => ({
      ...token,
      is_known:
        token.target_lemma_id != null &&
        token.effective_score >= PIPELINE_CONFIG.REPLACEMENT_THRESHOLD,
    }))
  }
}
