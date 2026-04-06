import type { Token } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 5: Phase 1 — Known Word Replacement
// Marks tokens whose effective_score meets the replacement threshold as known.
// Only tokens with a translation mapping are eligible.

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
