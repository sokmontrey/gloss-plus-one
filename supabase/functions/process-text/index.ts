import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { ProcessTextRequest, ProcessTextResponse } from './types.ts'
import { NoOpExpressionDetector } from './stages/expression-detector.ts'
import { SimpleTokenLemmatizer } from './stages/token-lemmatizer.ts'
import { DbTranslationAligner } from './stages/translation-aligner.ts'
import { DbProgressionLookup } from './stages/progression-lookup.ts'
import { ThresholdReplacer } from './stages/known-replacer.ts'
import { CategoryContextScorer } from './stages/context-scorer.ts'
import { TopNSelector } from './stages/i1-selector.ts'
import { DbProgressionUpdater } from './stages/progression-updater.ts'
import { SegmentAssembler } from './stages/response-assembler.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    // User-scoped client for all DB operations — RLS enforces data boundaries.
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    // --- Request validation ---
    const body = await req.json() as Partial<ProcessTextRequest>

    if (
      typeof body.text !== 'string' || body.text.trim().length === 0 ||
      typeof body.source_language !== 'string' ||
      typeof body.target_language !== 'string'
    ) {
      return json(
        { error: 'Invalid request: text, source_language, and target_language are required' },
        400,
      )
    }

    const request: ProcessTextRequest = {
      text: body.text,
      source_language: body.source_language,
      target_language: body.target_language,
      max_new_words: typeof body.max_new_words === 'number' ? body.max_new_words : 3,
      source_url: body.source_url,
    }

    // --- Resolve ISO codes to language UUIDs ---
    const { data: langRows, error: langError } = await client
      .from('languages')
      .select('id, code')
      .in('code', [request.source_language, request.target_language])

    if (langError) {
      return json({ error: 'Failed to resolve language codes' }, 500)
    }

    const langByCode = new Map((langRows ?? []).map((r: { id: string; code: string }) => [r.code, r.id]))
    const sourceLangId = langByCode.get(request.source_language)
    const targetLangId = langByCode.get(request.target_language)

    if (!sourceLangId || !targetLangId) {
      return json(
        { error: `Unsupported language code: ${!sourceLangId ? request.source_language : request.target_language}` },
        400,
      )
    }

    console.log('[process-text]', {
      userId: user.id,
      sourceLang: request.source_language,
      targetLang: request.target_language,
      textLength: request.text.length,
      maxNewWords: request.max_new_words,
    })

    // --- Pipeline ---
    const expressionDetector = new NoOpExpressionDetector()
    const tokenizer = new SimpleTokenLemmatizer()
    const aligner = new DbTranslationAligner(client)
    const progressionLookup = new DbProgressionLookup(client)
    const replacer = new ThresholdReplacer()
    const contextScorer = new CategoryContextScorer()
    const selector = new TopNSelector()
    const updater = new DbProgressionUpdater(client)
    const assembler = new SegmentAssembler()

    // Stage 1: expression detection (passthrough in MVP)
    const processedText = expressionDetector.detect(request.text)

    // Stage 2: tokenize + lemmatize
    const rawTokens = tokenizer.process(processedText)

    // Stage 3: translation alignment (stamps target_lemma_id onto each token)
    const alignedTokens = await aligner.align(rawTokens, sourceLangId, targetLangId)

    // Stage 4: progression lookup + decay (stamps effective_score)
    const scoredTokens = await progressionLookup.lookup(alignedTokens, user.id, sourceLangId, targetLangId)

    // Stage 5: known word replacement (stamps is_known)
    const replacedTokens = replacer.replace(scoredTokens)

    // Stage 6: context scoring (stamps context_score)
    // maskedIndices = positions already replaced in phase 1; passed for future
    // ML scorers that need to know which tokens are already L2.
    const maskedIndices = replacedTokens.flatMap((t, i) => t.is_known ? [i] : [])
    const contextTokens = contextScorer.score(replacedTokens, maskedIndices)

    // Stage 7: i+1 selection (stamps is_new_l2)
    const selectedTokens = selector.select(contextTokens, request.max_new_words)

    // Stage 8: progression update — fire-and-forget to keep latency low.
    // TODO: add structured error reporting so silent failures surface in metrics.
    updater.update(selectedTokens, user.id).catch((err) => {
      console.error('[process-text] progression update failed:', err)
    })

    // Stage 9: response assembly
    const response: ProcessTextResponse = assembler.assemble(selectedTokens)

    // Log to processed_text_log — fire-and-forget.
    client.from('processed_text_log').insert({
      user_id: user.id,
      source_language_id: sourceLangId,
      target_language_id: targetLangId,
      word_count: response.stats.total_words,
      words_replaced: response.stats.known_replaced,
      words_introduced: response.stats.new_introduced,
      source_url: request.source_url ?? null,
    }).then(({ error }) => {
      if (error) console.error('[process-text] failed to write processed_text_log:', error.message)
    })

    return json(response)
  } catch (err) {
    console.error('[process-text] unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
