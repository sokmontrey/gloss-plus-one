import { callPlannerLLM, extractPageTopic, runPlanner } from "@/background/agent/planner";
import { synthesizeSpeech } from "@/background/api/elevenlabs";
import {
  getPhraseBank,
  recordExposure,
  recordHoverDecay,
  saveProgressionConfig,
  savePhraseBank,
  shouldTriggerProgression,
} from "@/background/memory/bankStore";
import {
  getPageSignals,
  recomputeInterestProfile,
  recordPageSignal,
} from "@/background/memory/pageSignalStore";
import { getUserContext } from "@/background/memory/store";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "@/shared/messages";
import type { BankPhrase } from "@/shared/types";

export async function routeBackgroundMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean | void> {
  switch (message.type) {
    case "GET_BANK": {
      const bank = await getPhraseBank(message.payload.language);
      sendResponse(bank.phrases);
      return true;
    }

    case "RECORD_EXPOSURE": {
      const { phraseId, url, title, language } = message.payload;
      await recordExposure(phraseId, url, title, language);
      break;
    }

    case "RECORD_HOVER_DECAY": {
      const { phraseId, language } = message.payload;
      await recordHoverDecay(phraseId, language);
      break;
    }

    case "CHECK_PROGRESSION": {
      const { language } = message.payload;
      const shouldProgress = await shouldTriggerProgression(language);
      if (shouldProgress) {
        console.log("[GlossPlusOne:router] Progression triggered");
        void runPlanner("progression", language);
      }
      break;
    }

    case "TRIGGER_PLANNER": {
      const { reason, language } = message.payload;
      await runPlanner(reason, language);

      const tabId = sender.tab?.id;
      if (typeof tabId === "number") {
        const bank = await getPhraseBank(language);
        const response: BackgroundToContentMessage = {
          type: "BANK_READY",
          payload: bank.phrases,
        };

        chrome.tabs.sendMessage(tabId, response).catch((error) => {
          console.warn("[GlossPlusOne:router] Failed to send BANK_READY", error);
        });
      }
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
        visitedAt: Date.now(),
      });

      const signals = await getPageSignals();
      const shouldRefreshProfile = signals.length % 5 === 0;
      if (shouldRefreshProfile) {
        void recomputeInterestProfile();
      }

      void extractPageTopic(payload.title, payload.domain, payload.pageType).then(async (topic) => {
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
      const normalizedPhrase = phrase.replace(/\s+/g, " ").trim();
      const userContext = await getUserContext();
      const prompt = `Translate this phrase to ${language}.
Native language: ${userContext.nativeLanguage}
Phrase: "${normalizedPhrase}"

Reply ONLY with valid JSON:
{"targetPhrase":"translation","phraseType":"structural|lexical","tier":1}`;

      try {
        const raw = await callPlannerLLM(prompt);
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as {
          targetPhrase: string;
          phraseType: "structural" | "lexical";
          tier: number;
        };

        const bank = await getPhraseBank(language);
        const existing = bank.phrases.find(
          (entry) => entry.phrase.toLowerCase() === normalizedPhrase.toLowerCase(),
        );
        if (existing) {
          sendResponse({ success: true, targetPhrase: existing.targetPhrase });
          return true;
        }

        const batchId = crypto.randomUUID();
        const newPhrase: BankPhrase = {
          id: crypto.randomUUID(),
          phrase: normalizedPhrase,
          targetPhrase: parsed.targetPhrase.replace(/\s+/g, " ").trim(),
          targetLanguage: language,
          nativeLanguage: userContext.nativeLanguage,
          phraseType: parsed.phraseType,
          tier: Math.max(1, Math.min(6, Math.round(parsed.tier || 1))),
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
        bank.currentTier = Math.max(bank.currentTier, newPhrase.tier);

        await savePhraseBank(bank);

        const tabId = sender.tab?.id;
        if (typeof tabId === "number") {
          const response: BackgroundToContentMessage = {
            type: "BANK_READY",
            payload: bank.phrases,
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

    default: {
      break;
    }
  }
}
