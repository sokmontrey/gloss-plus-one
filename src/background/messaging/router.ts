import { buildReplacementPlans } from "@/background/agent/planner";
import {
  getPhraseState,
  recordPhraseExposure,
  recordPhrasePassed,
  recordPhraseReveal,
  touchPhraseSession,
} from "@/background/memory/phraseStore";
import { getUserContext, syncNarrativeToBackboard } from "@/background/memory/store";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "@/shared/messages";

let interactionCountSinceSync = 0;

export async function routeBackgroundMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  switch (message.type) {
    case "PAGE_LOADED": {
      await touchPhraseSession(message.at);
      console.debug("[GlossPlusOne/background] Page loaded", {
        url: message.url,
        title: message.title,
      });
      break;
    }

    case "WORD_SIGNAL": {
      const { phrase, foreignPhrase, targetLanguage, phraseType, signal, url, title } = message.payload;

      if (signal === "exposure") {
        await recordPhraseExposure(phrase, foreignPhrase, targetLanguage, phraseType, url, title);
      } else if (signal === "reveal") {
        await recordPhraseReveal(phrase, targetLanguage);
      } else if (signal === "pass") {
        await recordPhrasePassed(phrase, targetLanguage);
      }

      interactionCountSinceSync += 1;
      if (interactionCountSinceSync >= 5) {
        interactionCountSinceSync = 0;
        const [phraseState, userContext] = await Promise.all([getPhraseState(), getUserContext()]);
        void syncNarrativeToBackboard(phraseState, userContext);
      }
      break;
    }

    case "REQUEST_PLAN": {
      console.log(
        `[GlossPlusOne:router] REQUEST_PLAN received — ${message.payload.paragraphs.length} paragraphs`,
      );
      const plans = await buildReplacementPlans(message.payload);
      const tabId = sender.tab?.id;

      if (typeof tabId !== "number") {
        console.warn("[GlossPlusOne/background] Cannot deliver PLAN_READY without tab id");
        break;
      }

      const response: BackgroundToContentMessage = {
        type: "PLAN_READY",
        payload: plans,
      };

      console.log(`[GlossPlusOne:router] PLAN_READY sending — ${plans.length} plans`);
      chrome.tabs.sendMessage(tabId, response).catch((error) => {
        console.warn("[GlossPlusOne/background] Failed to send PLAN_READY", error);
      });
      break;
    }

    default: {
      break;
    }
  }
}
