import type { UserContext } from "@/shared/types";

const USER_CONTEXT_STORAGE_KEY = "userContext";

const DEFAULT_USER_CONTEXT: UserContext = {
  cefrBand: "A2",
  cefrConfidence: 30,
  targetLanguage: "es",
  nativeLanguage: "en",
  knownPhrases: [],
  immersionIntensity: 0.35,
  sessionFatigueSignal: false,
  sessionDepth: 0,
};

const VALID_CEFR_BANDS = new Set<UserContext["cefrBand"]>(["A1", "A2", "B1", "B2", "C1", "C2"]);
const VALID_TARGET_LANGUAGES = new Set<UserContext["targetLanguage"]>([
  "es",
  "fr",
  "de",
  "pt",
  "it",
]);

function readStorageValue<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const value = result[key] as T | undefined;
      resolve(value);
    });
  });
}

function writeStorageValue<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sanitizeUserContext(input: unknown): Partial<UserContext> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as Record<string, unknown>;
  const sanitized: Partial<UserContext> = {};

  if (typeof candidate.cefrBand === "string" && VALID_CEFR_BANDS.has(candidate.cefrBand as UserContext["cefrBand"])) {
    sanitized.cefrBand = candidate.cefrBand as UserContext["cefrBand"];
  }

  if (typeof candidate.cefrConfidence === "number") {
    sanitized.cefrConfidence = candidate.cefrConfidence;
  }

  if (
    typeof candidate.targetLanguage === "string" &&
    VALID_TARGET_LANGUAGES.has(candidate.targetLanguage as UserContext["targetLanguage"])
  ) {
    sanitized.targetLanguage = candidate.targetLanguage as UserContext["targetLanguage"];
  }

  if (typeof candidate.nativeLanguage === "string") {
    sanitized.nativeLanguage = candidate.nativeLanguage;
  }

  if (isStringArray(candidate.knownPhrases)) {
    sanitized.knownPhrases = candidate.knownPhrases;
  }

  if (typeof candidate.immersionIntensity === "number") {
    sanitized.immersionIntensity = candidate.immersionIntensity;
  }

  if (typeof candidate.sessionFatigueSignal === "boolean") {
    sanitized.sessionFatigueSignal = candidate.sessionFatigueSignal;
  }

  if (typeof candidate.sessionDepth === "number") {
    sanitized.sessionDepth = candidate.sessionDepth;
  }

  return sanitized;
}

export async function getUserContext(): Promise<UserContext> {
  try {
    const stored = await readStorageValue<unknown>(USER_CONTEXT_STORAGE_KEY);

    return {
      ...DEFAULT_USER_CONTEXT,
      ...sanitizeUserContext(stored),
    };
  } catch (error) {
    console.warn("[GlossPlusOne:store] Failed to read user context, using defaults", error);
    return { ...DEFAULT_USER_CONTEXT };
  }
}

export async function saveUserContext(partial: Partial<UserContext>): Promise<void> {
  try {
    const current = await getUserContext();
    const next: UserContext = {
      ...current,
      ...sanitizeUserContext(partial),
    };

    await writeStorageValue(USER_CONTEXT_STORAGE_KEY, next);
  } catch (error) {
    console.warn("[GlossPlusOne:store] Failed to save user context", error);
  }
}
