import { z } from "npm:zod@^3"
import { TranslationService } from "./translate/index.ts";
import { UnitTagService } from "./unit-tag/index.ts";
import { RecoverabilityService } from "./recoverability/index.ts";



// ── Shared ────────────────────────────────────────────────────────────────────

export const LanguageCodeSchema = z.enum(['en', 'pt'])
export const EnvSchema = z.object({
    SB_TRANSLATE_DEEPL_API_URL: z.string(),
    SB_TRANSLATE_DEEPL_API_KEY: z.string(),
    SB_RECOVERABILITY_MLM_URL: z.string(),
});

// ── Request ───────────────────────────────────────────────────────────────────

export const ReplacementRequestSchema = z.object({
  id: z.string(),
  text: z.string(),
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

export const ReplacementResponseSchema = z.object({
  id: z.string(),
  replacements: z.array(ReplacementSchema),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type LanguageCode = z.infer<typeof LanguageCodeSchema>
export type ReplacementRequest = z.infer<typeof ReplacementRequestSchema>
export type Replacement = z.infer<typeof ReplacementSchema>
export type ReplacementResponse = z.infer<typeof ReplacementResponseSchema>
export type EnvType = z.infer<typeof EnvSchema>;

export interface Services {
    translationService: TranslationService,
    unitTagService: UnitTagService,
    recoverabilityService: RecoverabilityService,
}
