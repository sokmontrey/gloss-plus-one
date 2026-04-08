import { createClient } from 'jsr:@supabase/supabase-js@2'

// Active engagement endpoint.
// Called by the client when the user hovers or clicks a new_l2 word.
// Applies ACTIVE_ENGAGEMENT_BUMP to the word's progression via the
// upsert_progression RPC — a larger bump than passive exposure (0.05)
// to reflect intentional interaction.
//
// The client is responsible for deduplicating events: send once per
// word per page view, not on every hover tick.

const ACTIVE_ENGAGEMENT_BUMP = 0.10

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    const body = await req.json() as { target_lemma_id?: string }

    if (typeof body.target_lemma_id !== 'string' || !body.target_lemma_id) {
      return json({ error: 'target_lemma_id is required' }, 400)
    }

    // p_scores: initial progression_score if this is a new row (no prior exposure).
    // p_bump: added to the existing score on conflict (DO UPDATE path).
    // Both are ACTIVE_ENGAGEMENT_BUMP — new encounters and re-encounters get the same boost.
    const { error } = await client.rpc('upsert_progression', {
      p_user_id: user.id,
      p_lemma_ids: [body.target_lemma_id],
      p_scores: [ACTIVE_ENGAGEMENT_BUMP],
      p_bump: ACTIVE_ENGAGEMENT_BUMP,
    })

    if (error) {
      console.error('[engagement] upsert_progression error:', error.message)
      return json({ error: 'Failed to record engagement' }, 500)
    }

    console.log('[engagement]', { userId: user.id, lemmaId: body.target_lemma_id })
    return json({ ok: true })
  } catch (err) {
    console.error('[engagement] unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
