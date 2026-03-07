interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  parts?: GeminiPart[];
}

interface GeminiCandidate {
  content?: GeminiContent;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 15_000;

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    console.log(`[GlossPlusOne:gemini] Sending prompt — ${prompt.length} chars`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`GEMINI_HTTP_ERROR: ${response.status}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("GEMINI_EMPTY_RESPONSE");
    }

    console.log(`[GlossPlusOne:gemini] Response received — ${text.length} chars`);
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("GEMINI_TIMEOUT");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("GEMINI_UNKNOWN_ERROR");
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
