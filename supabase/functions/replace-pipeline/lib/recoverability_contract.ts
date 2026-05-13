/**
 * Recoverability scorer — **HTTP contract** for backend implementers.
 *
 * Edge posts to `{RECOVERABILITY_API_URL}{RECOVERABILITY_SCORE_PATH}` (default `/score`).
 */

export type RecoverabilityScoreConfig = {
  window_tokens?: number
  stride_tokens?: number
  batch_size?: number
}

export type RecoverabilitySpanV1 = {
  /** UTF-16 code unit offset into `text` (same as JS `String#slice`) */
  start: number
  end: number
}

/**
 * V1 request (`RECOVERABILITY_REQUEST_FORMAT=spans`, default).
 * Server should verify `token_surfaces[i] === text.slice(spans[i].start, spans[i].end)`.
 */
export type RecoverabilityScoreRequestV1 = {
  schema_version: 1
  text: string
  spans: RecoverabilitySpanV1[]
  token_surfaces: string[]
  config?: RecoverabilityScoreConfig
}

/** Legacy (`RECOVERABILITY_REQUEST_FORMAT=words`): server space-joins words for MLM. */
export type RecoverabilityScoreRequestWordsLegacy = {
  words: string[]
  config?: RecoverabilityScoreConfig
}

export type RecoverabilityScoreRowV1 = {
  index?: number
  start?: number
  end?: number
  text?: string
  recoverability?: number
  /** @deprecated prefer recoverability */
  replaceability?: number
  avg_log_prob?: number
}

export type RecoverabilityScoreResponseV1 = {
  schema_version?: 1
  request_id?: string
  model_name?: string
  scores: RecoverabilityScoreRowV1[] | Array<Record<string, unknown>>
  summary?: Record<string, unknown>
}
