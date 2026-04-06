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

    // User-scoped client: validates the JWT via getUser()
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    // Service-role client: used for DB writes (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // --- Request validation ---
    const body = await req.json() as Partial<ProcessTextRequest>

    if (
      typeof body.text !== 'string' || body.text.trim().length === 0 ||
      typeof body.source_language !== 'string' ||
      typeof body.target_language !== 'string'
    ) {
      return json({ error: 'Invalid request: text, source_language, and target_language are required' }, 400)
    }

    const request: ProcessTextRequest = {
      text: body.text,
      source_language: body.source_language,
      target_language: body.target_language,
      max_new_words: typeof body.max_new_words === 'number' ? body.max_new_words : 3,
      source_url: body.source_url,
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
    const aligner = new DbTranslationAligner(serviceClient)
    const progressionLookup = new DbProgressionLookup(serviceClient)
    const replacer = new ThresholdReplacer()
    const contextScorer = new CategoryContextScorer()
    const selector = new TopNSelector()
    const updater = new DbProgressionUpdater(serviceClient)
    const assembler = new SegmentAssembler()

    // Stage 1: expression detection (passthrough in MVP)
    const processedText = expressionDetector.detect(request.text)

    // Stage 2: tokenize + lemmatize
    let tokens = tokenizer.process(processedText)

    // Stage 3: translation alignment
    tokens = await aligner.align(tokens, request.source_language, request.target_language)

    // Stage 4: progression lookup + decay
    tokens = await progressionLookup.lookup(tokens, user.id)

    // Stage 5: known word replacement
    tokens = replacer.replace(tokens)

    // Stage 6: context scoring
    tokens = contextScorer.score(tokens)

    // Stage 7: i+1 selection
    tokens = selector.select(tokens, request.max_new_words)

    // Stage 8: progression update (fire-and-forget; don't block the response)
    updater.update(tokens, user.id).catch((err) => {
      console.error('[process-text] progression update failed:', err)
    })

    // Stage 9: response assembly
    const response: ProcessTextResponse = assembler.assemble(tokens)

    return json(response)
  } catch (err) {
    console.error('[process-text] unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
