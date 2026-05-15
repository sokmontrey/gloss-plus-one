import { z } from "zod"

// ── Shared ────────────────────────────────────────────────────────────────────

export const LanguageCodeSchema = z.enum(['en', 'fr', 'es'])

// ── Request ───────────────────────────────────────────────────────────────────

export const ReplacementRequestSchema = z.object({
  id: z.string(),
  text: z.string(),
  originalLanguage: LanguageCodeSchema,
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
