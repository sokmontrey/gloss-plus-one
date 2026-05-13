import type { SupabaseClient } from "@supabase/supabase-js"
import type { PresetSlices } from "./lib/preset_map.ts"

/** HTTP contract (extension → Edge). Unchanged v1. */
export type PipelineBlockIn = {
  blockId: string
  text: string
}

export type PipelineRequestV1 = {
  schemaVersion: 1
  url?: string
  reason?: string
  blocks: PipelineBlockIn[]
}

export type InlineEdit = {
  id: string
  start: number
  end: number
  original: string
  replacement: string
  highlight?: { level?: "low" | "medium" | "high"; color?: string; borderStyle?: string }
  data?: Record<string, unknown>
}

export type PipelineResponseV1 = {
  schemaVersion: 1
  requestId: string
  blocks: Array<{ blockId: string; edits: InlineEdit[] }>
  data?: Record<string, unknown>
}

/** One lazily-delivered walker block; pipeline runs independently per invocation. */
export type WordSpan = {
  raw: string
  start: number
  end: number
}

/**
 * Naming: “confident” / confidence scores (0–1), not “progression”.
 * Offsets refer to `sourceText` unless step tracks parallel normalized string.
 */
export type BlockConfidenceState = {
  blockId: string
  sourceText: string
  normalizedText: string
  tokens: WordSpan[]
  /** NFKC/lowercase keyed for DB rows; aligns with tokens[] */
  lookupKeys: string[]
  perWordTranslation: string[]
  contextRecoverability: number[]
  userConfidentScore: number[]
  presetConfidentScore: number[]
  firstPassConfident: number[]
  secondPassConfident: number[]
  combinedConfident: number[]
  replaceable: boolean[]
  /** Batch lookup found a row keyed by normalized `lookupKeys[i]` before this-request inserts */
  userHadLexiconRow: boolean[]
  edits: InlineEdit[]
}

export type PipelineContext = {
  requestId: string
  userId: string
  supabase: SupabaseClient
  targetLanguage: string
  presetSlices: PresetSlices
  /** Normalized keys already inserted earlier this invoke (cross lazy blocks) */
  persistedLexiconKeysThisInvoke: Set<string>
  url?: string
  reason?: string
}
