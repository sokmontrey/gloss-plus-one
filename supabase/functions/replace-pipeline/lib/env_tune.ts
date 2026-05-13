/** Env-driven threshold + fusion constants; minimal MVP knobs. */

function parseFloatEnv(key: string, fallback: number): number {
  const raw = Deno.env.get(key)
  if (!raw?.length) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function translationMvpFactor(): number {
  return parseFloatEnv("PIPELINE_TRANSLATION_FACTOR", 1)
}

export function contextStubMultiplier(): number {
  return parseFloatEnv("PIPELINE_CONTEXT_STUB", 1)
}

/** Per-language ENV `REPLACE_THRESHOLD_FR` overrides global `REPLACE_THRESHOLD`. */
export function thresholdForLanguage(lang: string): number {
  const spec = lang ? Deno.env.get(`REPLACE_THRESHOLD_${lang.toUpperCase()}`) : undefined
  if (spec !== undefined && Number.isFinite(Number(spec))) return Number(spec)

  const global = Deno.env.get("REPLACE_THRESHOLD")
  if (global?.length && Number.isFinite(Number(global))) return Number(global)

  return 0.42
}

export function highlightLevelFromCombined(score: number): "low" | "medium" | "high" {
  if (score >= 0.66) return "high"
  if (score >= 0.4) return "medium"
  return "low"
}
