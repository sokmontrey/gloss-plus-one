import type { BlockConfidenceState } from "../types.ts"
import type { RecoverabilityScoreConfig } from "./recoverability_contract.ts"
import { buildRecoverabilityScoreRequestV1 } from "./recoverability_payload.ts"

export type { RecoverabilityScoreConfig } from "./recoverability_contract.ts"

/** Legacy row shape for `words` API (space-joined scoring). */
export type WordRecoverabilityDto = {
  text: string
  recoverability: number
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(Math.max(v, 0), 1)
}

function scoreFieldFromObj(row: Record<string, unknown>): number {
  const v = row["recoverability"] ?? row["replaceability"]
  return clamp01(Number(v))
}

function buildUrl(baseUrl: string, scorePath: string): string {
  const base = baseUrl.replace(/\/+$/, "")
  const path = scorePath.startsWith("/") ? scorePath : `/${scorePath}`
  return `${base}${path}`
}

/**
 * Returns per-token recoverability in **`state.tokens`** order (length **n**).
 */
export async function fetchRecoverabilityLanes(
  baseUrl: string,
  scorePath: string,
  state: BlockConfidenceState,
  format: "spans" | "words",
  timeoutMs: number,
  config?: RecoverabilityScoreConfig,
): Promise<number[] | null> {
  const n = state.tokens.length
  if (!baseUrl.length || n === 0) return null

  const url = buildUrl(baseUrl, scorePath)

  const body: Record<string, unknown> =
    format === "spans"
      ? { ...buildRecoverabilityScoreRequestV1(state), ...(config ? { config } : {}) }
      : {
          words: state.tokens.map((t) => t.raw),
          ...(config ? { config } : {}),
        }

  try {
    const signal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.warn(`[recoverability] HTTP ${res.status}: ${errBody.slice(0, 280)}`)
      return null
    }

    const json = await res.json()

    if (format === "spans") {
      return parseSpansFormatResponse(json, state)
    }

    return parseWordsFormatResponse(json, state)
  } catch (e) {
    console.warn("[recoverability] fetch failed:", e)
    return null
  }
}

function parseSpansFormatResponse(json: unknown, state: BlockConfidenceState): number[] | null {
  if (!json || typeof json !== "object") return null
  const root = json as Record<string, unknown>
  const scores = root["scores"]
  if (!Array.isArray(scores) || scores.length === 0) return null

  const n = state.tokens.length
  const text = state.sourceText
  const spans = state.tokens.map((t) => ({ start: t.start, end: t.end }))
  const out = Array<number>(n).fill(0)

  const rows = scores as Array<Record<string, unknown>>

  if (rows.length === n) {
    for (let i = 0; i < n; i++) {
      out[i] = scoreFieldFromObj(rows[i]!)
    }
    return out
  }

  for (let i = 0; i < n; i++) {
    const span = spans[i]!
    const byCoord = rows.find(
      (r) => Number(r["start"]) === span.start && Number(r["end"]) === span.end,
    )
    if (byCoord) {
      out[i] = scoreFieldFromObj(byCoord)
      continue
    }
    const surface = text.slice(span.start, span.end)
    const byText = rows.find((r) => String(r["text"] ?? "") === surface)
    if (byText) out[i] = scoreFieldFromObj(byText)
  }

  return out
}

function parseWordsFormatResponse(json: unknown, state: BlockConfidenceState): number[] | null {
  if (!json || typeof json !== "object") return null
  const scores = (json as Record<string, unknown>)["scores"]
  if (!Array.isArray(scores) || scores.length === 0) return null

  const dtos: WordRecoverabilityDto[] = scores.map((raw) => {
    const r = raw as Record<string, unknown>
    return {
      text: String(r["text"] ?? ""),
      recoverability: scoreFieldFromObj(r),
    }
  })

  return projectRecoverabilitiesToTokens(
    state.tokens.map((t) => t.raw),
    dtos,
  )
}

/** Map legacy `words` API rows → per-token lane (duplicate surfaces: greedy pool). */
export function projectRecoverabilitiesToTokens(
  tokenSurfaces: string[],
  apiRows: WordRecoverabilityDto[],
): number[] {
  if (
    apiRows.length === tokenSurfaces.length &&
    tokenSurfaces.every((t, i) => t === apiRows[i]!.text)
  ) {
    return apiRows.map((r) => clamp01(r.recoverability))
  }

  const pool = apiRows.slice()
  return tokenSurfaces.map((surface) => {
    const idx = pool.findIndex((r) => r.text === surface)
    if (idx === -1) return 0
    const [{ recoverability }] = pool.splice(idx, 1)
    return clamp01(recoverability)
  })
}
