import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
    EnvSchema,
    ReplacementRequestSchema,
    type ReplacementResponse,
} from "./types.ts";
import { runPipelineBatch, type Services } from "./pipeline.ts";
import { CerebrasTranslationService } from "./translate/cerebras.ts";
import { DeepLTranslationService } from "./translate/deepl.ts";
import { MlmRecoverabilityService } from "./recoverability/mlm.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

const envParseResult = EnvSchema.safeParse(Deno.env.toObject());
if (!envParseResult.success) {
    throw new Error("Invalid environment variables");
}
const env = envParseResult.data;

// Which translation backend to use is a deploy-time config choice
// (`SB_TRANSLATE_PROVIDER`), not something to toggle by editing code.
const translationService = env.SB_TRANSLATE_PROVIDER === "cerebras"
    ? new CerebrasTranslationService(env.SB_TRANSLATE_CEREBRAS_API_KEY)
    : new DeepLTranslationService(
        env.SB_TRANSLATE_DEEPL_API_URL,
        env.SB_TRANSLATE_DEEPL_API_KEY,
    );

const services: Services = {
    translationService,
    recoverabilityService: new MlmRecoverabilityService(
        env.SB_RECOVERABILITY_MLM_URL,
    ),
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return jsonResponse({ error: "missing authorization" }, 401);
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
    });

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    if (error || !user) {
        return jsonResponse({ error: "unauthorized" }, 401);
    }

    let json: unknown;
    try {
        json = await req.json();
    } catch (e) {
        console.error("json parse error:", e);
        return jsonResponse({ error: "invalid json" }, 400);
    }

    const parsed = ReplacementRequestSchema.safeParse(json);
    if (!parsed.success) {
        console.error("request validation error:", parsed.error);
        return jsonResponse({ error: parsed.error.flatten() }, 400);
    }

    const body = parsed.data;

    let results: ReplacementResponse["results"];
    try {
        results = await runPipelineBatch(
            body.items,
            body.sourceLanguage,
            body.targetLanguage,
            services,
        );
    } catch (e) {
        console.error("pipeline error:", e);
        return jsonResponse(
            { error: "pipeline failed", detail: String(e) },
            502,
        );
    }

    return jsonResponse({ results });
});
