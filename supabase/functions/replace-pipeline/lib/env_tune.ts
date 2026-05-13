/** Env-driven threshold + fusion constants; minimal MVP knobs. */

import type { RecoverabilityScoreConfig } from "./recoverability_contract.ts"

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

export function recoverabilityApiDisabledFlag(): boolean {
  const raw = (Deno.env.get("RECOVERABILITY_DISABLED") ?? Deno.env.get("REPLACEABILITY_DISABLED"))
    ?.trim()
    .toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function recoverabilityApiBaseUrl(): string | undefined {
  const u =
    (Deno.env.get("RECOVERABILITY_API_URL") ?? Deno.env.get("REPLACEABILITY_API_URL"))?.trim()
  return u?.length ? u.replace(/\/+$/, "") : undefined
}

export function recoverabilityRequestTimeoutMs(): number {
  const pick =
    Deno.env.get("RECOVERABILITY_TIMEOUT_MS") ?? Deno.env.get("REPLACEABILITY_TIMEOUT_MS")
  if (pick?.length && Number.isFinite(Number(pick))) return Number(pick)
  return 120_000
}

export function recoverabilityScoreConfigFromEnv(): RecoverabilityScoreConfig | undefined {
  const raw =
    (Deno.env.get("RECOVERABILITY_SCORE_CONFIG_JSON") ?? Deno.env.get("REPLACEABILITY_SCORE_CONFIG_JSON"))
      ?.trim()
  if (!raw) return undefined
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const cfg: RecoverabilityScoreConfig = {}
    for (const k of ["window_tokens", "stride_tokens", "batch_size"] as const) {
      const v = o[k]
      if (typeof v === "number" && Number.isFinite(v)) cfg[k] = Math.trunc(v)
    }
    return Object.keys(cfg).length ? cfg : undefined
  } catch {
    console.warn("[replace-pipeline] recoverability score config JSON parse failed")
    return undefined
  }
}

/** `spans` (default) = `RecoverabilityScoreRequestV1`; `words` = legacy space-join API */
export function recoverabilityRequestFormat(): "spans" | "words" {
  const v = Deno.env.get("RECOVERABILITY_REQUEST_FORMAT")?.trim().toLowerCase()
  return v === "words" ? "words" : "spans"
}

/** Path appended to API base (must start with `/`). Default `/score` */
export function recoverabilityScorePath(): string {
  const p = Deno.env.get("RECOVERABILITY_SCORE_PATH")?.trim()
  if (!p?.length) return "/score"
  return p.startsWith("/") ? p : `/${p}`
}


export function highlightLevelFromCombined(score: number): "low" | "medium" | "high" {
  if (score >= 0.66) return "high"
  if (score >= 0.4) return "medium"
  return "low"
}
