import type { Token } from '../types.ts'

// Stage 2: Tokenize & Lemmatize
// MVP: splits on word boundaries, lowercases as lemma, marks punctuation/
// whitespace as non-word pass-throughs. POS is always 'unknown' until a
// real NLP service is wired in.
//
// The regex splits the text into alternating word / non-word spans so the
// assembler can reconstruct the original string faithfully.

export class SimpleTokenLemmatizer {
  process(text: string): Token[] {
    const tokens: Token[] = []
    // Match either a word (\w+) or any run of non-word characters.
    const spans = text.match(/\w+|[^\w]+/g) ?? []

    for (const span of spans) {
      const is_word = /^\w+$/.test(span)
      tokens.push({
        original: span,
        lemma: is_word ? span.toLowerCase() : span,
        pos: 'unknown',
        is_word,
        expression_id: null,
        source_lemma_id: null,
        target_lemma_id: null,
        target_lemma: null,
        category: null,
        effective_score: 0,
        is_known: false,
        context_score: 0,
        is_new_l2: false,
      })
    }

    return tokens
  }
}
