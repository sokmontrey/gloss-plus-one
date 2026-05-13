/** NFKC lowercase key for preset / user_lexicon lookups; never mutates DOM offsets string. */

const LEAD_PUNC = /^[\u2018\u2019"'([\{]+/u
const TRAIL_PUNC = /[\u2026.,;:!?)\]\}"'\u2018\u2019]+$/u

export function stripNoiseForLexeme(surface: string): string {
  return surface.replace(LEAD_PUNC, "").replace(TRAIL_PUNC, "").trim()
}

export function normalizeLexemeKey(surface: string): string {
  const stripped = stripNoiseForLexeme(surface)
  return stripped.normalize("NFKC").toLowerCase()
}

export function mimicCaseReplacement(replacementAscii: string, originalSurface: string): string {
  if (!replacementAscii) return replacementAscii
  if (/^[^\p{L}]*$/u.test(originalSurface)) return replacementAscii
  const lettersOnly = [...originalSurface].filter((ch) => /\p{L}/u.test(ch))
  if (!lettersOnly.length) return replacementAscii
  const allLettersUpper = lettersOnly.every((ch) => ch === ch.toUpperCase())
  if (allLettersUpper) return replacementAscii.toUpperCase()
  const trimmed = originalSurface.trimStart()
  const firstSemantic = /\p{L}/u.exec(trimmed)
  const firstSemanticUpper = !!(firstSemantic && firstSemantic[0] === firstSemantic[0].toUpperCase())
  if (!firstSemanticUpper) return replacementAscii.toLowerCase()
  const rep = [...replacementAscii]
  const ix = rep.findIndex((ch) => /\p{L}/u.test(ch))
  if (ix === -1) return replacementAscii
  rep[ix] = rep[ix].toUpperCase()
  return rep.join("")
}
