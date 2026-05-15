import "@supabase/functions-js/edge-runtime.d.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const TIMEOUT_MS = 15000

const SERVICES = [
  {
    name: "lexicon-service",
    url: Deno.env.get("LEXICON_URL") ?? "http://localhost:8001",
    probe: async (base: string) => {
      const res = await fetch(`${base}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hi" }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      return res.ok
    },
  },
  {
    name: "mlm-service",
    url: Deno.env.get("MLM_URL") ?? "http://localhost:8002",
    probe: async (base: string) => {
      const res = await fetch(`${base}/recoverable_score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hi" }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      return res.ok
    },
  },
  {
    name: "translation-service",
    url: Deno.env.get("TRANSLATION_URL") ?? "http://localhost:8003",
    probe: async (base: string) => {
      const res = await fetch(`${base}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "hi",
          lexicons: [{ id: 0, start: 0, end: 2, text: "hi" }],
          target_lang: "fr",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      return res.ok
    },
  },
]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const results = await Promise.all(
    SERVICES.map(async ({ name, url, probe }) => {
      const start = Date.now()
      try {
        const ok = await probe(url)
        return { service: name, url, status: ok ? "ok" : "error", ms: Date.now() - start }
      } catch (e) {
        return { service: name, url, status: "unreachable", error: String(e), ms: Date.now() - start }
      }
    }),
  )

  const allOk = results.every((r) => r.status === "ok")

  return new Response(JSON.stringify({ healthy: allOk, services: results }, null, 2), {
    status: allOk ? 200 : 502,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
})
