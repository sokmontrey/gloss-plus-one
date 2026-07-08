import { z } from "npm:zod@^3"
import { TranslationService } from "./translate/index.ts";
import { UnitTagService } from "./unit-tag/index.ts";
import { RecoverabilityService } from "./recoverability/index.ts";



// ── Shared ────────────────────────────────────────────────────────────────────

export const LanguageCodeSchema = z.enum(['en', 'pt'])
export const EnvSchema = z.object({
    SB_TRANSLATE_DEEPL_API_URL: z.string(),
    SB_TRANSLATE_DEEPL_API_KEY: z.string(),
    SB_TRANSLATE_CEREBRAS_API_KEY: z.string(),
    SB_RECOVERABILITY_MLM_URL: z.string(),
});

// ── Request ───────────────────────────────────────────────────────────────────

// A single request now carries a *batch* of items so the client can group
// several text blocks (e.g. ones extracted close together in time) into one
// HTTP call instead of firing one call per block. `items` must be non-empty
// and is capped to keep any single request (and its downstream translation
// calls) bounded in size.
export const ReplacementItemSchema = z.object({
  id: z.string(),
  text: z.string(),
})

export const ReplacementRequestSchema = z.object({
  items: z.array(ReplacementItemSchema).min(1).max(50),
  sourceLanguage: LanguageCodeSchema,
  targetLanguage: LanguageCodeSchema,
})

// ── Response ──────────────────────────────────────────────────────────────────

export const ReplacementSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  original: z.string(),
  replacement: z.string(),
  score: z.number().optional(),
})

// Each item is resolved independently so one failing item (e.g. a translation
// provider error) doesn't fail the whole batch — `error` is set instead of
// `replacements` being populated.
export const ReplacementResultSchema = z.object({
  id: z.string(),
  replacements: z.array(ReplacementSchema),
  error: z.string().optional(),
})

export const ReplacementResponseSchema = z.object({
  results: z.array(ReplacementResultSchema),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type LanguageCode = z.infer<typeof LanguageCodeSchema>
export type ReplacementItem = z.infer<typeof ReplacementItemSchema>
export type ReplacementRequest = z.infer<typeof ReplacementRequestSchema>
export type Replacement = z.infer<typeof ReplacementSchema>
export type ReplacementResult = z.infer<typeof ReplacementResultSchema>
export type ReplacementResponse = z.infer<typeof ReplacementResponseSchema>
export type EnvType = z.infer<typeof EnvSchema>;

export interface Services {
    translationService: TranslationService,
    unitTagService: UnitTagService,
    recoverabilityService: RecoverabilityService,
}
