import type { Replacement } from "./types.ts"

const LEXICON_URL = Deno.env.get("LEXICON_URL") ?? "http://localhost:8001"
const TRANSLATION_URL = Deno.env.get("TRANSLATION_URL") ?? "http://localhost:8003"
const MLM_URL = Deno.env.get("MLM_URL") ?? "http://localhost:8002"

// Enough recoverable context for safe i+1 replacement
const SCORE_THRESHOLD = 0.85

// Replace function words — high-scoring ones are trivially recoverable from context,
// making them safe candidates for i+1 grammar learning
const REPLACEABLE_TYPES = new Set(["function"])

// ── Service response shapes ───────────────────────────────────────────────────

interface Lexicon {
  id: number
  start: number
  end: number
  text: string
  type: string
}

interface MlmToken {
  text: string
  start: number
  end: number
  score: number | null
}

interface TranslationItem {
  id: number
  source: string
  target: string | null
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchLexicons(text: string): Promise<Lexicon[]> {
  const res = await fetch(`${LEXICON_URL}/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`lexicon-service ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.lexicons
}

async function fetchTranslations(
  text: string,
  lexicons: Lexicon[],
  targetLang: string,
): Promise<TranslationItem[]> {
  const res = await fetch(`${TRANSLATION_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      lexicons: lexicons.map((l) => ({ id: l.id, start: l.start, end: l.end, text: l.text })),
      target_lang: targetLang,
    }),
  })
  if (!res.ok) throw new Error(`translation-service ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.translations
}

async function fetchMlmScores(
  text: string,
  includeRanges: Array<{ start: number; end: number }>,
): Promise<MlmToken[]> {
  const res = await fetch(`${MLM_URL}/recoverable_score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, include_ranges: includeRanges }),
  })
  if (!res.ok) throw new Error(`mlm-service ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.tokens
}

// ── Score mapping ─────────────────────────────────────────────────────────────

function lexiconScore(
  lexStart: number,
  lexEnd: number,
  mlmTokens: MlmToken[],
): number | null {
  const overlapping = mlmTokens.filter(
    (t) => t.score !== null && t.start < lexEnd && t.end > lexStart,
  )
  if (overlapping.length === 0) return null
  const sum = overlapping.reduce((acc, t) => acc + (t.score as number), 0)
  return sum / overlapping.length
}

// ── Main orchestration ────────────────────────────────────────────────────────

export async function runPipeline(
  text: string,
  targetLanguage: string,
): Promise<Replacement[]> {
  const t0 = Date.now()

  // Step 1: get lexicons — needed to know which positions to score
  const lexicons = await fetchLexicons(text)
  console.info(`[pipeline] lexicons: ${Date.now() - t0}ms (${lexicons.length} items)`)

  const replaceableLexicons = lexicons.filter((l) => REPLACEABLE_TYPES.has(l.type))
  if (replaceableLexicons.length === 0) return []

  // Step 2: MLM (only function word positions) + translation in parallel.
  // Passing include_ranges cuts scored tokens from ~150 to ~10-20.
  const includeRanges = replaceableLexicons.map((l) => ({ start: l.start, end: l.end }))
  const t1 = Date.now()

  const [mlmTokens, translations] = await Promise.all([
    fetchMlmScores(text, includeRanges),
    fetchTranslations(text, replaceableLexicons, targetLanguage),
  ])
  console.info(`[pipeline] mlm+translate: ${Date.now() - t1}ms`)

  // Step 3: build lookup map
  const translationById = new Map<number, string | null>(
    translations.map((t) => [t.id, t.target]),
  )

  // Step 4: filter and build replacements
  const replacements: Replacement[] = []

  for (const lex of replaceableLexicons) {
    const score = lexiconScore(lex.start, lex.end, mlmTokens)
    if (score === null || score < SCORE_THRESHOLD) continue

    const target = translationById.get(lex.id)
    if (!target) continue

    replacements.push({
      start: lex.start,
      end: lex.end,
      original: lex.text,
      replacement: target,
      score,
    })
  }

  console.info(`[pipeline] total: ${Date.now() - t0}ms → ${replacements.length} replacements`)
  return replacements
}
