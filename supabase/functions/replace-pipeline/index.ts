import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

/**
 * Gloss+1 pipeline v1 — extension POSTs extraction blocks; returns inline edits JSON.
 * Replace `placeholderReplace` with routed steps (context score, LLM, etc.) later.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type PipelineBlockIn = {
  blockId: string
  text: string
}

type PipelineRequestV1 = {
  schemaVersion: 1
  url?: string
  reason?: string
  blocks: PipelineBlockIn[]
}

type InlineEdit = {
  id: string
  start: number
  end: number
  original: string
  replacement: string
  highlight?: { level?: "low" | "medium" | "high"; color?: string; borderStyle?: string }
  data?: Record<string, unknown>
}

type PipelineResponseV1 = {
  schemaVersion: 1
  requestId: string
  blocks: Array<{ blockId: string; edits: InlineEdit[] }>
  data?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let payload: PipelineRequestV1
  try {
    payload = (await req.json()) as PipelineRequestV1
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (payload.schemaVersion !== 1 || !Array.isArray(payload.blocks)) {
    return new Response(JSON.stringify({ error: "Invalid pipeline request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const responseBody = await runPipelineV1(payload)

  return new Response(JSON.stringify(responseBody), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})

async function runPipelineV1(request: PipelineRequestV1): Promise<PipelineResponseV1> {
  const requestId = `pipeline-v1-${Date.now()}-${crypto.randomUUID()}`
  // Future: concurrent steps / scoring; keep synchronous placeholder for now.
  return placeholderReplace(requestId, request.blocks, request.url, request.reason)
}

function placeholderReplace(
  requestId: string,
  blocks: PipelineBlockIn[],
  _url?: string,
  _reason?: string,
): PipelineResponseV1 {
  return {
    schemaVersion: 1,
    requestId,
    blocks: blocks
      .map((block) => ({
        blockId: block.blockId,
        edits: standaloneICandidatePositions(block.text).map((start, index) => ({
          id: `${requestId}-${block.blockId}-${index}`,
          start,
          end: start + 1,
          original: "I",
          replacement: "Ye",
          highlight: { level: "medium" as const },
          data: { source: "edge-placeholder" },
        })),
      }))
      .filter((b) => b.edits.length > 0),
    data: { source: "edge-placeholder-pipeline-v1" },
  }
}

function standaloneICandidatePositions(text: string): number[] {
  const starts: number[] = []
  const pattern = /\bI\b/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    starts.push(match.index)
  }
  return starts
}
