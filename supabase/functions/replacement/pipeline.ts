import type { Replacement } from "./types.ts"

const LEXICON_URL = Deno.env.get("LEXICON_URL") ?? "http://localhost:8001"
const TRANSLATION_URL = Deno.env.get("TRANSLATION_URL") ?? "http://localhost:8003"
const MLM_URL = Deno.env.get("MLM_URL") ?? "http://localhost:8002"

const SCORE_THRESHOLD = 0.95

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

// ── Parallel fetch helpers ────────────────────────────────────────────────────

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

async function fetchMlmScores(text: string): Promise<MlmToken[]> {
  const res = await fetch(`${MLM_URL}/recoverable_score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`mlm-service ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.tokens
}

// ── Score mapping ─────────────────────────────────────────────────────────────

/**
 * Compute the average MLM score for a lexicon span.
 * Only tokens with non-null scores that overlap [lexStart, lexEnd) are included.
 * Returns null if no scorable tokens overlap.
 */
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
  // Step 1: split + MLM score in parallel (translation needs lexicons first)
  const [lexicons, mlmTokens] = await Promise.all([
    fetchLexicons(text),
    fetchMlmScores(text),
  ])

  // Step 2: translate only replaceable lexicons
  const replaceableLexicons = lexicons.filter((l) => REPLACEABLE_TYPES.has(l.type))
  const translations = replaceableLexicons.length > 0
    ? await fetchTranslations(text, replaceableLexicons, targetLanguage)
    : []

  // Step 3: build lookup maps
  const translationById = new Map<number, string | null>(
    translations.map((t) => [t.id, t.target]),
  )

  // Step 4: filter and build replacement edits
  // Function words with high recoverability scores are safe to replace —
  // the reader can infer their meaning from surrounding context
  const replacements: Replacement[] = []

  for (const lex of lexicons) {
    if (!REPLACEABLE_TYPES.has(lex.type)) continue

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

  return replacements
}
