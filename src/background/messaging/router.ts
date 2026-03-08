import { callPlannerLLM, runPlanner } from "@/background/agent/planner";
import {
  getPhraseBank,
  recordExposure,
  recordHoverDecay,
  saveProgressionConfig,
  shouldTriggerProgression,
} from "@/background/memory/bankStore";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "@/shared/messages";

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

    default: {
      break;
    }
  }
}
