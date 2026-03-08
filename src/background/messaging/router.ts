import {
  callPlannerLLM,
  clearProcessedUrls,
  ensureStructuralTranslations,
  extractPageTopic,
  runPageDiscovery,
  runPlanner,
} from "@/background/agent/planner";
import { synthesizeSpeech } from "@/background/api/elevenlabs";
import { callGemini } from "@/background/api/gemini";
import { callGroq } from "@/background/api/groq";
import {
  consumeProgressionTrigger,
  getPhraseBank,
  recordExposure,
  recordHoverDecay,
  resetPhraseBank,
  saveProgressionConfig,
  savePhraseBank,
} from "@/background/memory/bankStore";
import {
  getPageSignals,
  recomputeInterestProfile,
  recordPageSignal,
} from "@/background/memory/pageSignalStore";
import { getUserContext, saveUserContext } from "@/background/memory/store";
import { STRUCTURAL_PHRASES } from "@/shared/structuralPhrases";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "@/shared/messages";
import type { BankPhrase } from "@/shared/types";

async function callStructuredTranslationLLM(
  prompt: string,
  responseMimeType = "application/json",
): Promise<string> {
  try {
    return await callGemini(prompt, responseMimeType);
  } catch (error) {
    console.warn("[GlossPlusOne:router] Gemini translation failed, trying Groq:", error);
  }

  return await callGroq(prompt, responseMimeType);
}

function normalizeSelectedPhrase(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

function parsePlainTranslation(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .trim();
}

async function translateSelectedPhrase(
  phrase: string,
  language: string,
  nativeLanguage: string,
): Promise<string> {
  const prompt = `Translate this English phrase into ${language}.
Native language context: ${nativeLanguage}
Phrase: "${phrase}"

Return only the translated phrase in ${language}.
No JSON. No explanation. No quotes.`;

  const raw = await callStructuredTranslationLLM(prompt, "text/plain");
  const targetPhrase = parsePlainTranslation(raw);
  if (!targetPhrase) {
    throw new Error("ADD_PHRASE_TARGET_MISSING");
  }
  return targetPhrase;
}

export async function routeBackgroundMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean | void> {
  switch (message.type) {
    case "GET_BANK": {
      const bank = await getPhraseBank(message.payload.language);
      sendResponse({
        language: message.payload.language,
        phrases: bank.phrases,
        currentTier: bank.currentTier,
        lastBatchId: bank.lastBatchId,
        reason: "bank_sync",
      });
      return true;
    }

    case "RECORD_EXPOSURE": {
      const { phraseId, url, title, language } = message.payload;
      await recordExposure(phraseId, url, title, language);
      const consumed = await consumeProgressionTrigger(language);
      if (consumed) {
        console.log("[GlossPlusOne:router] Progression triggered after exposure");
        await clearProcessedUrls(language);
        void runPlanner("progression", language);
      }
      break;
    }

    case "RECORD_HOVER_DECAY": {
      const { phraseId, language } = message.payload;
      await recordHoverDecay(phraseId, language);
      break;
    }

    case "CHECK_PROGRESSION": {
      const { language } = message.payload;
      const consumed = await consumeProgressionTrigger(language);
      if (consumed) {
        console.log("[GlossPlusOne:router] Progression triggered");
        await clearProcessedUrls(language);
        void runPlanner("progression", language);
      }
      break;
    }

    case "TRIGGER_PLANNER": {
      const { reason, language } = message.payload;
      if (reason === "progression" || reason === "debug_increment") {
        await clearProcessedUrls(language);
      }
      void runPlanner(reason, language);
      break;
    }

    case "ENSURE_STRUCTURAL_TRANSLATIONS": {
      const { language } = message.payload as { language: string };
      const userContext = await getUserContext();
      void ensureStructuralTranslations(language, userContext.nativeLanguage);
      break;
    }

    case "RESET_LANGUAGE_DATA": {
      const { language } = message.payload as { language: string };
      await Promise.all([
        resetPhraseBank(language),
        clearProcessedUrls(language),
      ]);
      console.log(`[GlossPlusOne:router] Reset language data for ${language}`);
      break;
    }

    case "RUN_PAGE_DISCOVERY": {
      const { pageText, pageTitle, pageUrl, language } =
        message.payload as {
          pageText: string;
          pageTitle: string;
          pageUrl: string;
          language: string;
        };
      void runPageDiscovery(pageText, pageTitle, pageUrl, language);
      break;
    }

    case "FETCH_DEFINITION": {
      const { foreignPhrase, originalPhrase, language } = message.payload;
      const prompt = `Define "${foreignPhrase}" in ${language} in 1 simple sentence using only ${language}. No English. No quotes. Max 15 words.`;

      try {
        const definition = await callPlannerLLM(prompt, "text/plain");
        sendResponse({ definition: definition.trim().replace(/^"+|"+$/g, "") });
      } catch {
        sendResponse({ definition: originalPhrase });
      }
      return true;
    }

    case "UPDATE_PROGRESSION_CONFIG": {
      await saveProgressionConfig(message.payload);
      break;
    }

    case "REQUEST_AUDIO": {
      const { text, language } = message.payload;

      try {
        const dataUri = await synthesizeSpeech(text, language);
        sendResponse({ dataUri });
      } catch (error) {
        console.error("[GlossPlusOne:router] Audio synthesis failed:", error);
        sendResponse({ error: error instanceof Error ? error.message : "UNKNOWN" });
      }
      return true;
    }

    case "REPORT_PAGE_SIGNAL": {
      const payload = message.payload;
      console.log(
        `[GlossPlusOne:router] Recording page signal for ${payload.domain} (${payload.replacementCount} replacements)`,
      );

      await recordPageSignal({
        url: payload.url,
        title: payload.title,
        domain: payload.domain,
        pageType: payload.pageType,
        replacementCount: payload.replacementCount,
        topic: null,
        contentSnippet: payload.contentSnippet,
        visitedAt: Date.now(),
      });

      const signals = await getPageSignals();
      const shouldRefreshProfile = signals.length % 5 === 0;
      if (shouldRefreshProfile) {
        void recomputeInterestProfile();
      }

      void extractPageTopic(payload.title, payload.domain, payload.pageType, payload.contentSnippet).then(async (topic) => {
        if (!topic) {
          return;
        }

        const stored = await getPageSignals();
        const signal = [...stored]
          .reverse()
          .find((entry) => entry.url === payload.url && entry.title === payload.title && entry.topic === null);
        if (!signal) {
          return;
        }

        signal.topic = topic;
        await chrome.storage.local.set({ glossPageSignals: stored });
        console.log(`[GlossPlusOne:router] Page topic extracted: ${topic}`);

        if (shouldRefreshProfile) {
          void recomputeInterestProfile();
        }
      });

      break;
    }

    case "ADD_PHRASE_TO_BANK": {
      const { phrase, language, sourceUrl, sourceTitle } = message.payload;
      const normalizedPhrase = normalizeSelectedPhrase(phrase);
      const normalizedBankPhrase = normalizedPhrase.toLowerCase();
      if (!normalizedBankPhrase) {
        sendResponse({ success: false });
        return true;
      }

      const bank = await getPhraseBank(language);
      const existing = bank.phrases.find(
        (entry) => entry.phrase.toLowerCase() === normalizedBankPhrase,
      );
      if (existing) {
        sendResponse({ success: true, targetPhrase: existing.targetPhrase });
        return true;
      }

      const userContext = await getUserContext();
      const structural = STRUCTURAL_PHRASES.find(
        (entry) => entry.phrase === normalizedBankPhrase,
      );

      try {
        const targetPhrase = await translateSelectedPhrase(
          normalizedPhrase,
          language,
          userContext.nativeLanguage,
        );

        const batchId = crypto.randomUUID();
        const newPhrase: BankPhrase = {
          id: crypto.randomUUID(),
          phrase: normalizedBankPhrase,
          targetPhrase,
          targetLanguage: language,
          nativeLanguage: userContext.nativeLanguage,
          phraseType: structural ? "structural" : "lexical",
          tier: structural?.tier ?? bank.currentTier,
          addedAt: Date.now(),
          addedByBatch: batchId,
          confidence: 0,
          exposures: 0,
          hoverCount: 0,
          lastSeenAt: 0,
          firstSeenUrl: sourceUrl,
          firstSeenTitle: sourceTitle,
        };

        bank.phrases.push(newPhrase);
        bank.batches.push({
          id: batchId,
          addedAt: Date.now(),
          tier: newPhrase.tier,
          triggerReason: "manual",
          phraseCount: 1,
          plannerContext: `User selected: "${normalizedPhrase}"`,
        });
        bank.lastBatchId = batchId;
        bank.lastPlannerRunAt = Date.now();

        await savePhraseBank(bank);

        const tabId = sender.tab?.id;
        if (typeof tabId === "number") {
          const response: BackgroundToContentMessage = {
            type: "BANK_READY",
            payload: {
              language,
              phrases: bank.phrases,
              currentTier: bank.currentTier,
              lastBatchId: bank.lastBatchId,
              reason: "manual",
            },
          };
          chrome.tabs.sendMessage(tabId, response).catch((error) => {
            console.warn("[GlossPlusOne:router] Failed to send BANK_READY after manual add", error);
          });
        }

        console.log(
          `[GlossPlusOne:router] User added phrase: "${normalizedPhrase}" → "${newPhrase.targetPhrase}" (${language})`,
        );

        sendResponse({
          success: true,
          targetPhrase: newPhrase.targetPhrase,
        });
      } catch (error) {
        console.error("[GlossPlusOne:router] Add phrase failed:", error);
        sendResponse({ success: false });
      }

      return true;
    }

    case "ASSESS_TRANSLATION": {
      const { phrase, userTranslation, language } = message.payload;
      
      try {
        const userContext = await getUserContext();
        const prompt = `You are an encouraging language teacher evaluating a user's translation attempt.
Native language context: ${userContext.nativeLanguage}
Target language: ${language}
Original Phrase to Translate: "${phrase}"
User's Translation Attempt: "${userTranslation}"

Evaluate the user's translation. Return a JSON object with:
- "score": A number from 0 to 5, where 0 is completely wrong and 5 is perfect.
- "most_correct_translation": The most natural and correct translation in the target language.
- "feedback": Extremely concise feedback (max 1 short sentence). Be encouraging but brief.

Return ONLY pure JSON. No markdown blocks, no quotes, no explanation.`;

        const rawResponse = await callStructuredTranslationLLM(prompt, "application/json");
        const jsonText = rawResponse.replace(/```[\s\S]*?```/g, "").replace(/^```json|```$/g, "").trim();
        const result = JSON.parse(jsonText);
        
        if (typeof result.score === "number") {
          const newScore = (userContext.assessmentScore || 0) + result.score;
          await saveUserContext({ assessmentScore: newScore });
          console.log(`[GlossPlusOne:router] Assessed translation score ${result.score}/5. New total: ${newScore}`);
        }

        sendResponse({ success: true, result });
      } catch (error) {
        console.error("[GlossPlusOne:router] Translation assessment failed:", error);
        sendResponse({ success: false, error: "Failed to assess translation." });
      }
      return true;
    }

    default: {
      break;
    }
  }
}
