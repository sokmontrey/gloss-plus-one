import type { LanguageCode } from "../types.ts";
import type { TranslationService } from "./index.ts";

interface CerebrasChoice {
    message: { content: string };
}

interface CerebrasResponse {
    choices: CerebrasChoice[];
}

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
    en: "English",
    pt: "Brazilian Portuguese (PT-BR)",
};

// ── Retry/timeout tuning ─────────────────────────────────────────────────────
//
// Cerebras enforces a tokens-per-minute quota and responds with 429 when it's
// exceeded. We retry those (and transient 5xx errors) with exponential
// backoff, honoring a `Retry-After` header when present. Every attempt has
// its own hard timeout so a stalled request can't hang the pipeline forever.

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 20_000;
const REQUEST_TIMEOUT_MS = 30_000;

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelayMs(attempt: number, retryAfterHeader: string | null): number {
    if (retryAfterHeader) {
        const seconds = Number(retryAfterHeader);
        if (Number.isFinite(seconds) && seconds > 0) {
            return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
        }
    }

    const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
    const jitter = Math.random() * 250;
    return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

function buildSystemPrompt(
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
): string {
    const sourceName = LANGUAGE_NAMES[sourceLanguage];
    const targetName = LANGUAGE_NAMES[targetLanguage];

    return `You are a translation assistant for a language-learning system that uses inline tags to mark translatable units within a sentence. Work in two explicit steps.

INPUT FORMAT
Text in ${sourceName} with inline tags like <x0>word or phrase</x0>. Tags mark candidate units for independent translation; untagged text stays in ${sourceName}.

STEP 1: ISOLATED SPAN TRANSLATION
For each tag, translate ONLY the text inside it, on its own, with no sentence context. Write these out as a scratch list internally: x0 → ..., x1 → ..., etc. This is your reference for what each span "should" produce alone.

STEP 2: FULL SENTENCE TRANSLATION + RECONCILE
Translate the entire sentence naturally into ${targetName}. Then, for each tag, check: does the isolated translation from Step 1 appear intact, in the same relative position, inside the full-sentence translation?

- If YES: apply the tag to that matching span as-is.
- If NO, because a word from the span got absorbed, deleted, or merged into a neighboring word outside the original tag boundary (e.g. one word covers two source words, or a word from the span is missing) → EXPAND the tag to include the neighboring word(s) it depends on, so the tagged span is self-contained again.
- If expanding would make the span too large or grammatically awkward → DROP the tag instead (leave that part untranslated).

Never leave a tag whose isolated translation doesn't actually appear intact in the full sentence.

OUTPUT
Return ONLY the final tagged, translated sentence. No scratch list, no explanation, no JSON.`;
}

export class CerebrasTranslationService implements TranslationService {
    private readonly apiUrl: string;
    private readonly apiKey: string;

    constructor(
        apiKey: string,
        apiUrl = "https://api.cerebras.ai/v1/chat/completions",
    ) {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
    }

    async translate(
        sourceText: string[],
        sourceLanguage: LanguageCode,
        targetLanguage: LanguageCode,
    ): Promise<string[]> {
        const systemPrompt = buildSystemPrompt(sourceLanguage, targetLanguage);

        return Promise.all(
            sourceText.map((text) => this.translateOne(text, systemPrompt)),
        );
    }

    private async translateOne(
        text: string,
        systemPrompt: string,
    ): Promise<string> {
        let lastError: unknown;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                REQUEST_TIMEOUT_MS,
            );

            try {
                const response = await fetch(this.apiUrl, {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: "gpt-oss-120b",
                        stream: false,
                        max_tokens: 32768,
                        temperature: 1,
                        top_p: 1,
                        reasoning_effort: "low",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: text },
                        ],
                    }),
                });

                if (!response.ok) {
                    const bodyText = await response.text();
                    const error = new Error(
                        `Cerebras API error: ${response.status} ${bodyText}`,
                    );

                    if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
                        lastError = error;
                        const delay = computeRetryDelayMs(
                            attempt,
                            response.headers.get("retry-after"),
                        );
                        console.warn(
                            `[cerebras] request failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
                        );
                        await sleep(delay);
                        continue;
                    }

                    throw error;
                }

                const data = (await response.json()) as CerebrasResponse;
                const content = data.choices[0]?.message?.content;

                if (content === undefined) {
                    throw new Error("Cerebras API returned no content");
                }

                return content;
            } catch (e) {
                const isTimeout = e instanceof DOMException && e.name === "AbortError";
                if (isTimeout) {
                    const timeoutError = new Error(
                        `Cerebras API request timed out after ${REQUEST_TIMEOUT_MS}ms`,
                    );

                    if (attempt < MAX_RETRIES) {
                        lastError = timeoutError;
                        const delay = computeRetryDelayMs(attempt, null);
                        console.warn(
                            `[cerebras] request timed out, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
                        );
                        await sleep(delay);
                        continue;
                    }

                    throw timeoutError;
                }

                throw e;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        throw lastError ?? new Error("Cerebras API request failed after retries");
    }
}
