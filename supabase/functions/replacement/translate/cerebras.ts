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

// EXPERIMENTAL: item delimiters so an entire batch of independent texts can
// be sent to (and parsed back from) Cerebras in a single request, instead
// of one request per text.
const ITEM_OPEN = (index: number) => `[[[ITEM ${index}]]]`;
const ITEM_CLOSE = (index: number) => `[[[/ITEM ${index}]]]`;

function buildBatchUserMessage(items: string[]): string {
    return items
        .map((text, index) => `${ITEM_OPEN(index)}\n${text}\n${ITEM_CLOSE(index)}`)
        .join("\n\n");
}

function parseBatchResponse(content: string, expectedCount: number): string[] {
    const regex = /\[\[\[ITEM (\d+)\]\]\]([\s\S]*?)\[\[\[\/ITEM \1\]\]\]/g;
    const found = new Map<number, string>();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        found.set(Number(match[1]), match[2].trim());
    }

    const results: string[] = [];
    for (let i = 0; i < expectedCount; i++) {
        const text = found.get(i);
        if (text === undefined) {
            throw new Error(
                `Cerebras batch response missing item ${i} (found ${found.size}/${expectedCount} items)`,
            );
        }
        results.push(text);
    }

    return results;
}

function buildSystemPrompt(
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
): string {
    const sourceName = LANGUAGE_NAMES[sourceLanguage];
    const targetName = LANGUAGE_NAMES[targetLanguage];

    return `You are a translation assistant for a language-learning system that uses inline tags to mark translatable units within a sentence. You will be given a BATCH of independent text items in a single request; process every item and return a translation for every item.

INPUT FORMAT
The user message contains one or more items, each wrapped exactly like this:
${ITEM_OPEN(0)}
<text for the item, in ${sourceName}, with inline tags like <x0>word or phrase</x0>>
${ITEM_CLOSE(0)}
Items are completely independent — never let content, tag ids, or context from one item influence another item. Tags mark candidate units for independent translation; untagged text stays in ${sourceName}.

For EACH item, work in two explicit steps:

STEP 1: ISOLATED SPAN TRANSLATION
For each tag in the item, translate ONLY the text inside it, on its own, with no sentence context. Keep this as an internal scratch list (x0 → ..., x1 → ..., etc.) — this is your reference for what each span "should" produce alone.

STEP 2: FULL TEXT TRANSLATION + RECONCILE
Translate the item's entire text naturally into ${targetName}. Then, for each tag, check: does the isolated translation from Step 1 appear intact, in the same relative position, inside the full translation?

- If YES: apply the tag to that matching span as-is.
- If NO, because a word from the span got absorbed, deleted, or merged into a neighboring word outside the original tag boundary (e.g. one word covers two source words, or a word from the span is missing) → EXPAND the tag to include the neighboring word(s) it depends on, so the tagged span is self-contained again.
- If expanding would make the span too large or grammatically awkward → DROP the tag instead (leave that part untranslated).

Never leave a tag whose isolated translation doesn't actually appear intact in the full translation.

OUTPUT FORMAT
Return ONLY the translated items, each wrapped in the exact same markers as the input, preserving the item numbers and order exactly as given:
${ITEM_OPEN(0)}
<final tagged, translated text for the item>
${ITEM_CLOSE(0)}
No scratch list, no explanation, no JSON, and nothing outside the item markers.`;
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
        if (sourceText.length === 0) return [];

        // EXPERIMENTAL: the whole batch is folded into a single prompt and
        // sent as one request, instead of one request per text, to test
        // whether that still trips the provider's rate limit.
        const systemPrompt = buildSystemPrompt(sourceLanguage, targetLanguage);
        const userMessage = buildBatchUserMessage(sourceText);

        const content = await this.translateOne(userMessage, systemPrompt);
        return parseBatchResponse(content, sourceText.length);
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
