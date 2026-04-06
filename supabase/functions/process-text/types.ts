// ---- Public API ----

export interface ProcessTextRequest {
  text: string
  source_language: string   // ISO 639-1 ('en', 'ko', ...)
  target_language: string   // ISO 639-1
  max_new_words: number     // i+1 budget per request; default 3
  source_url?: string
}

export interface ProcessTextResponse {
  segments: Segment[]
  new_exposures: ExposureSummary[]
  stats: {
    total_words: number
    known_replaced: number
    new_introduced: number
  }
}

export interface Segment {
  original: string
  display: string
  type: 'l1' | 'known_l2' | 'new_l2'
  target_lemma_id?: string
  progression_score?: number
  context_score?: number
}

export interface ExposureSummary {
  target_lemma_id: string
  display_form: string       // L2 surface form shown
  original_form: string      // L1 word it replaced
  new_progression_score: number
}

// ---- Internal pipeline token ----
// Starts as a basic Token after Stage 2; properties are added by each stage.

export interface Token {
  original: string           // raw surface form preserving casing
  lemma: string              // lowercased normalized form
  pos: string                // 'unknown' in MVP (not constrained to pos_tag enum)
  is_word: boolean           // false for punctuation/whitespace pass-throughs

  // Stage 3: translation alignment
  source_lemma_id: string | null
  target_lemma_id: string | null
  target_lemma: string | null
  category: string | null    // 'function' | 'content' | null

  // Stage 4: progression lookup
  effective_score: number    // after decay; SCORE_FLOOR for unseen lemmas

  // Stage 5: known replacement
  is_known: boolean

  // Stage 6: context scoring
  context_score: number

  // Stage 7: i+1 selection
  is_new_l2: boolean
}

// Row returned from the lemmas + translation_mappings join (Stage 3)
export interface LemmaRow {
  id: string
  lemma: string
  pos: string
  category: string
  translation_mappings: Array<{
    target_lemma_id: string
    lemmas: { lemma: string; pos: string } | null
  }>
}

// Row from user_progression (Stage 4)
export interface ProgressionRow {
  lemma_id: string
  progression_score: number
  exposure_count: number
  last_seen_at: string | null   // null until first seen after row creation
}
