const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function callGemini(
  prompt: string,
  responseMimeType = "application/json",
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[GlossPlusOne:gemini] Sending — ${prompt.length} chars`);

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("[GlossPlusOne:gemini] Error:", response.status, body);
      throw new Error(`GEMINI_HTTP_ERROR: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const rawCandidates = data.candidates;
    const firstCandidate =
      Array.isArray(rawCandidates) && rawCandidates.length > 0 && isRecord(rawCandidates[0])
        ? rawCandidates[0]
        : undefined;
    const content = firstCandidate && isRecord(firstCandidate.content) ? firstCandidate.content : undefined;
    const rawParts = content?.parts;
    const firstPart = Array.isArray(rawParts) && rawParts.length > 0 && isRecord(rawParts[0]) ? rawParts[0] : undefined;
    const text = typeof firstPart?.text === "string" ? firstPart.text : undefined;

    if (!text) {
      throw new Error("GEMINI_EMPTY_RESPONSE");
    }

    console.log(`[GlossPlusOne:gemini] Response — ${text.length} chars`);
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("GEMINI_TIMEOUT");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
