const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
] as const;
const TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function callGroq(prompt: string, responseMimeType = "application/json"): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_KEY_MISSING");

  console.log(
    `[GlossPlusOne:groq] Sending prompt — ${prompt.length} chars across ${GROQ_MODELS.length} model(s)`,
  );

  let lastError: unknown = null;
  for (const model of GROQ_MODELS) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      console.log(`[GlossPlusOne:groq] Trying model: ${model}`);

      const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
          ...(responseMimeType === "application/json"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[GlossPlusOne:groq] HTTP error for ${model}:`, res.status, body);
        throw new Error(`GROQ_HTTP_ERROR: ${res.status}`);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const rawChoices = data.choices;
      const firstChoice =
        Array.isArray(rawChoices) && rawChoices.length > 0 && isRecord(rawChoices[0])
          ? rawChoices[0]
          : undefined;
      const message = firstChoice && isRecord(firstChoice.message) ? firstChoice.message : undefined;
      const text = message && typeof message.content === "string" ? message.content : undefined;

      if (
        firstChoice?.finish_reason &&
        (firstChoice.finish_reason === "length" || firstChoice.finish_reason === "content_filter")
      ) {
        console.warn(`[GlossPlusOne:groq] Interrupted generation for ${model}: ${firstChoice.finish_reason}`);
        throw new Error(`GROQ_INTERRUPTED: ${firstChoice.finish_reason}`);
      }

      if (!text) {
        console.error(`[GlossPlusOne:groq] Empty response for ${model}:`, data);
        throw new Error("GROQ_EMPTY_RESPONSE");
      }

      console.log(`[GlossPlusOne:groq] Response received from ${model} — ${text.length} chars`);
      return text;
    } catch (err) {
      lastError = err instanceof Error && err.name === "AbortError"
        ? new Error("GROQ_TIMEOUT")
        : err;
      console.warn(`[GlossPlusOne:groq] Model failed: ${model}`, lastError);
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GROQ_ALL_MODELS_FAILED");
}
