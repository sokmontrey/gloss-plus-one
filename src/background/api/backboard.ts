const BACKBOARD_API_BASE = "https://app.backboard.io/api";
const TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const candidate = value[key];
  return isRecord(candidate) ? candidate : undefined;
}

function getFirstRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const candidate = value[key];
  if (!Array.isArray(candidate) || candidate.length === 0) {
    return undefined;
  }

  const first = candidate[0];
  return isRecord(first) ? first : undefined;
}

function extractResponseText(data: Record<string, unknown>): string | undefined {
  if (typeof data.content === "string") {
    return data.content;
  }

  const output = getNestedRecord(data, "output");
  if (output && typeof output.text === "string") {
    return output.text;
  }

  const message = getNestedRecord(data, "message");
  if (message && typeof message.content === "string") {
    return message.content;
  }

  const firstChoice = getFirstRecord(data, "choices");
  const choiceMessage = firstChoice ? getNestedRecord(firstChoice, "message") : undefined;
  if (choiceMessage && typeof choiceMessage.content === "string") {
    return choiceMessage.content;
  }

  const firstCandidate = getFirstRecord(data, "candidates");
  const candidateContent = firstCandidate ? getNestedRecord(firstCandidate, "content") : undefined;
  const candidateParts = candidateContent?.parts;
  if (Array.isArray(candidateParts) && candidateParts.length > 0) {
    const firstPart = candidateParts[0];
    if (isRecord(firstPart) && typeof firstPart.text === "string") {
      return firstPart.text;
    }
  }

  return undefined;
}

async function getOrCreateThreadId(): Promise<string> {
  const result = await chrome.storage.local.get("backboardThreadId");
  const existingThreadId = result.backboardThreadId;
  if (typeof existingThreadId === "string" && existingThreadId.length > 0) {
    return existingThreadId;
  }

  const apiKey = import.meta.env.VITE_BACKBOARD_API_KEY?.trim();
  const assistantId = import.meta.env.VITE_BACKBOARD_ASSISTANT_ID?.trim();

  if (!apiKey || !assistantId) {
    throw new Error("BACKBOARD_CONFIG_MISSING");
  }

  const res = await fetch(`${BACKBOARD_API_BASE}/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assistant_id: assistantId }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[GlossPlusOne:backboard] Thread creation failed:", res.status, body);
    throw new Error(`BACKBOARD_THREAD_ERROR: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const threadIdValue = data.id ?? data.thread_id ?? data.threadId;
  if (typeof threadIdValue !== "string" || threadIdValue.length === 0) {
    console.error("[GlossPlusOne:backboard] No thread ID in response:", data);
    throw new Error("BACKBOARD_NO_THREAD_ID");
  }

  await chrome.storage.local.set({ backboardThreadId: threadIdValue });
  console.log("[GlossPlusOne:backboard] Created new thread:", threadIdValue);
  return threadIdValue;
}

export async function callBackboard(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_BACKBOARD_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("BACKBOARD_KEY_MISSING");
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const threadId = await getOrCreateThreadId();

    console.log(
      `[GlossPlusOne:backboard] Sending prompt — ${prompt.length} chars | thread: ${threadId}`,
    );

    const res = await fetch(`${BACKBOARD_API_BASE}/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: prompt,
        memory: "Auto",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[GlossPlusOne:backboard] HTTP error:", res.status, body);
      throw new Error(`BACKBOARD_HTTP_ERROR: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    console.log("[GlossPlusOne:backboard] Raw response shape:", Object.keys(data));

    const text = extractResponseText(data);
    if (typeof text !== "string" || text.trim().length === 0) {
      console.error(
        "[GlossPlusOne:backboard] Empty or missing text. Full response:",
        JSON.stringify(data, null, 2),
      );
      throw new Error("BACKBOARD_EMPTY_RESPONSE");
    }

    console.log(`[GlossPlusOne:backboard] Response received — ${text.length} chars`);
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("BACKBOARD_TIMEOUT");
    }

    throw err;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
