import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ReplacementRequestSchema, type ReplacementResponse } from "./types.ts";
import { runPipeline } from "./pipeline.ts";
import { LexiconClass } from "./lexicon/lexicon.ts";
import { TranslationClass } from "./translation/translation.ts";
import { RecoverClass } from "./recoverablity/recover.ts";
import { ReplacementClass } from "./replace/replacement.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Instantiate services once per container load
const lexiconService = new LexiconClass();
const translationService = new TranslationClass();
const recoverabilityService = new RecoverClass();
const replacementService = new ReplacementClass();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing authorization" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch (e) {
    console.error("json parse error:", e);
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const parsed = ReplacementRequestSchema.safeParse(json);
  if (!parsed.success) {
    console.error("json parse error:", parsed.error);
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const body = parsed.data;

  let replacements: ReplacementResponse["replacements"];
  try {
    replacements = await runPipeline(body.text, body.targetLanguage, {
      lexicon: lexiconService,
      translation: translationService,
      recoverability: recoverabilityService,
      replacement: replacementService,
    });
  } catch (e) {
    console.error("pipeline error:", e);
    return new Response(JSON.stringify({ error: "pipeline failed", detail: String(e) }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const response: ReplacementResponse = {
    id: body.id,
    replacements,
  };

  return new Response(JSON.stringify(response), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
