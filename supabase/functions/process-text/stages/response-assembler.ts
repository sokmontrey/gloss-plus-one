import type { Token, ProcessTextResponse, Segment, ExposureSummary } from '../types.ts'
import { PIPELINE_CONFIG } from '../config.ts'

// Stage 9: Response Assembly
// Converts the enriched token array into the public ProcessTextResponse shape.
// Consecutive l1 tokens are collapsed into single run segments to reduce payload size.

export class SegmentAssembler {
  assemble(tokens: Token[]): ProcessTextResponse {
    const segments: Segment[] = []
    const new_exposures: ExposureSummary[] = []
    let total_words = 0
    let known_replaced = 0
    let new_introduced = 0
    let l1Buffer = ''

    for (const token of tokens) {
      if (token.is_word) total_words++

      if (token.is_new_l2 && token.target_lemma_id && token.target_lemma) {
        if (l1Buffer) { segments.push({ type: 'l1', display: l1Buffer }); l1Buffer = '' }
        const progression_score = Math.min(token.effective_score + PIPELINE_CONFIG.I1_INTRODUCTION_BUMP, 1)
        segments.push({
          type: 'new_l2',
          display: token.target_lemma,
          original: token.original,
          target_lemma_id: token.target_lemma_id,
          progression_score,
        })
        new_exposures.push({
          target_lemma_id: token.target_lemma_id,
          display_form: token.target_lemma,
          original_form: token.original,
          new_progression_score: progression_score,
        })
        new_introduced++
      } else if (token.is_known && token.target_lemma_id && token.target_lemma) {
        if (l1Buffer) { segments.push({ type: 'l1', display: l1Buffer }); l1Buffer = '' }
        segments.push({
          type: 'known_l2',
          display: token.target_lemma,
          original: token.original,
          target_lemma_id: token.target_lemma_id,
          progression_score: Math.min(token.effective_score + PIPELINE_CONFIG.REINFORCEMENT_BUMP, 1),
        })
        known_replaced++
      } else {
        l1Buffer += token.original
      }
    }

    if (l1Buffer) segments.push({ type: 'l1', display: l1Buffer })

    return {
      segments,
      new_exposures,
      stats: { total_words, known_replaced, new_introduced },
    }
  }
}
