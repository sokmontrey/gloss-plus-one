const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const MULTILINGUAL_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const MULTILINGUAL_MODEL_ID = "eleven_multilingual_v2";

const audioCache = new Map<string, string>();

export async function synthesizeSpeech(text: string, language: string): Promise<string> {
  const normalizedText = text.trim();
  const cacheKey = `${language}::${normalizedText}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_KEY_MISSING");
  }

  console.log(`[GlossPlusOne:elevenlabs] Synthesizing "${normalizedText}" in ${language}`);

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${MULTILINGUAL_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: normalizedText,
        model_id: MULTILINGUAL_MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: false,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[GlossPlusOne:elevenlabs] Error:", response.status, body);
      throw new Error(`ELEVENLABS_HTTP_ERROR: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    const base64 = btoa(binary);
    const dataUri = `data:audio/mpeg;base64,${base64}`;

    audioCache.set(cacheKey, dataUri);
    if (audioCache.size > 100) {
      const firstKey = audioCache.keys().next().value;
      if (typeof firstKey === "string") {
        audioCache.delete(firstKey);
      }
    }

    console.log(`[GlossPlusOne:elevenlabs] Ready — cached "${normalizedText}"`);
    return dataUri;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ELEVENLABS_TIMEOUT");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
