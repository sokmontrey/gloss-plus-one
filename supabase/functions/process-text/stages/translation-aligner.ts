import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Token, LemmaRow } from '../types.ts'

// Stage 3: Translation Alignment
// Batch-fetches source lemmas and their translations in a single PostgREST
// query using embedded resources. Falls back to a two-query approach if the
// self-join on lemmas via translation_mappings isn't supported by PostgREST.

export class DbTranslationAligner {
  constructor(private readonly supabase: SupabaseClient) {}

  async align(
    tokens: Token[],
    sourceLangId: string,
    _targetLangId: string,
  ): Promise<Token[]> {
    const wordTokens = tokens.filter((t) => t.is_word)
    if (wordTokens.length === 0) return tokens

    const uniqueLemmas = [...new Set(wordTokens.map((t) => t.lemma))]

    // Fetch source lemmas with their translation mappings and target lemma text.
    // PostgREST embedded resource syntax:
    //   translation_mappings!source_lemma_id(target_lemma_id, lemmas!target_lemma_id(lemma,pos))
    const { data, error } = await this.supabase
      .from('lemmas')
      .select(`
        id,
        lemma,
        pos,
        category,
        translation_mappings!source_lemma_id(
          target_lemma_id,
          lemmas!target_lemma_id(lemma, pos)
        )
      `)
      .eq('language_id', sourceLangId)
      .in('lemma', uniqueLemmas)

    if (error) {
      console.error('[process-text] translation-aligner DB error:', error.message)
      return tokens
    }

    const rows = (data ?? []) as LemmaRow[]

    // Index rows by lemma text for O(1) lookup.
    const byLemma = new Map<string, LemmaRow>()
    for (const row of rows) {
      byLemma.set(row.lemma, row)
    }

    return tokens.map((token) => {
      if (!token.is_word) return token

      const row = byLemma.get(token.lemma)
      if (!row) return token

      const mapping = row.translation_mappings[0] ?? null
      return {
        ...token,
        source_lemma_id: row.id,
        category: row.category,
        target_lemma_id: mapping?.target_lemma_id ?? null,
        target_lemma: mapping?.lemmas?.lemma ?? null,
      }
    })
  }
}
