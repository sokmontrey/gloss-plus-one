import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
    EnvSchema,
    ReplacementRequestSchema,
    type ReplacementResponse,
    type Services,
} from "./types.ts";
import { runPipelineBatch } from "./pipeline.ts";
import { CerebrasTranslationService } from "./translate/cerebras.ts";
import { XmlUnitTagService } from "./unit-tag/xml.ts";
import { MlmRecoverabilityService } from "./recoverability/mlm.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const envParseResult = EnvSchema.safeParse(Deno.env.toObject());
if (!envParseResult.success) {
    throw new Error("Invalid environment variables");
}
const env = envParseResult.data;

const services: Services = {
    translationService: new CerebrasTranslationService(
        env.SB_TRANSLATE_CEREBRAS_API_KEY,
    ),
    unitTagService: new XmlUnitTagService(),
    recoverabilityService: new MlmRecoverabilityService(
        env.SB_RECOVERABILITY_MLM_URL,
    ),
};

Deno.serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return new Response(
            JSON.stringify({ error: "missing authorization" }),
            {
                status: 401,
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                },
            },
        );
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
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
        return new Response(
            JSON.stringify({ error: "pipeline failed", detail: String(e) }),
            {
                status: 502,
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                },
            },
        );
    }

    return new Response(
        JSON.stringify({ results }),
        {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
    );
});
