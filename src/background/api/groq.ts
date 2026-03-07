const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function callGroq(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_KEY_MISSING");

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[GlossPlusOne:groq] Sending prompt — ${prompt.length} chars`);

    const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[GlossPlusOne:groq] HTTP error:", res.status, body);
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

    if (!text) {
      console.error("[GlossPlusOne:groq] Empty response:", data);
      throw new Error("GROQ_EMPTY_RESPONSE");
    }

    console.log(`[GlossPlusOne:groq] Response received — ${text.length} chars`);
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("GROQ_TIMEOUT");
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
