# GlossPlusOne — Project Context

## What it is

**GlossPlusOne** is a Chrome extension (Manifest V3) for **sentence-level glossing** during reading: it replaces selected English phrases on web pages with their translations in a target language (e.g. Spanish, French). The goal is **Krashen-style i+1** learning: show a small number of “one step above” phrases per page, with progression driven by exposure and confidence.

---

## High-level architecture

- **Popup** (`src/popup/`): React UI for language, stage controls, progression threshold, page pause, and reset. Talks to the background via `chrome.runtime.sendMessage`.
- **Background** (`src/background/`): Service worker. Message router, phrase bank storage, planner (LLM), and external APIs (Gemini, Groq, Backboard, ElevenLabs). No UI.
- **Content script** (`src/content/`): Injected into every tab. Reads DOM, runs the two-path replacement pipeline, overlays (tooltip, selection “+ Learn”, TTS). Sends messages to the background and reacts to storage/`BANK_READY`.
- **Shared** (`src/shared/`): Types, message payloads, structural phrase list, phrase bank snapshot helpers, page-disable list, languages.

Build: Vite + CRXJS plugin; React + Tailwind/shadcn in popup and dashboard.

---

## Two-path replacement system

### Path A — Instant (no API)

- Content script loads; if the page is not disabled, it reads **user context** and **phrase bank** (from storage / `GET_BANK`).
- **Structural phrases** (from `src/shared/structuralPhrases.ts`) are filtered by **current tier**; the rest of the bank is used as-is. Together they form the “renderable” bank.
- For each readable paragraph (from `extractParagraphs`), it **regex-matches** bank phrases (longest first), builds **replacement instructions** (domPath, start/end, target phrase), then **clears** only the affected nodes and **applies** spans (gloss styling + hover).
- Goal: **replacements visible within ~500 ms** of load, without any LLM call.

### Path B — Per-URL discovery (async, LLM)

- After Path A has run (and if the bank was non-empty, or after it arrives), the content script runs **page discovery** once per “page identity.”
- **Page identity** = `urlHash::contentHash`: hash of hostname+pathname plus hash of full readable page text (so same URL but changed content is re-discovered).
- Content script sends **full readable page text** to the background via `RUN_PAGE_DISCOVERY` (page title, URL, language). Background truncates to **6,000 characters** for the LLM prompt to avoid overload and single-phrase responses.
- **Planner** (`runPageDiscovery` in `planner.ts`): if this `(urlHash::contentHash)` is not in the **processed set** for that language, it calls the LLM (Gemini → Groq fallback) with instructions to pick **5–8** phrases from the excerpt (i+1, structural first, present in text, not already in bank). Response is parsed (with repair for malformed JSON), deduplicated against the bank, then new phrases are appended to the bank, a new batch is recorded, and the URL+content key is marked processed.
- Bank is saved; content script sees the update via `chrome.storage.onChanged` and **re-renders** only affected paragraphs (no full-page flash).
- **Processed set** is per-language (e.g. `glossProcessedUrls:es`). It is **cleared** when the user clicks “Next stage” (debug_increment) or when **progression** is triggered (confidence threshold met on the latest discovery batch), so the next visit (or same page after reload) runs discovery again at the new tier.

---

## Phrase bank and progression

- **Phrase bank** is stored in `chrome.storage.local` under `glossPhraseBank`. It is keyed by language; each entry has `phrases[]`, `currentTier`, `batches[]`, `lastBatchId`, `lastPlannerRunAt`. Snapshot helpers live in `src/shared/phraseBankStorage.ts`; load/save in `src/background/memory/bankStore.ts`.
- **BankPhrase**: id, phrase (English), targetPhrase, targetLanguage, nativeLanguage, phraseType (structural | lexical), tier, addedAt, addedByBatch, confidence, exposures, hoverCount, lastSeenAt, firstSeenUrl/firstSeenTitle.
- **PhraseBatch**: id, addedAt, tier, triggerReason (initial | progression | debug_increment | debug_decrement | manual), phraseCount, plannerContext, and optionally progressionTriggeredAt when progression has been consumed for this batch.
- **Progression**: When the user sees replacements, the content script sends **RECORD_EXPOSURE** per phrase. The background updates confidence (configurable gain per exposure, decay per hover). **Progression trigger**: based on the **latest discovery batch** (initial or progression) that has not yet triggered, take up to 10 phrases with exposures, compute average confidence; if it meets the **progression threshold** (e.g. 0.7), **consumeProgressionTrigger** marks that batch’s `progressionTriggeredAt`, increments **currentTier**, clears processed URLs for that language, and runs the planner with reason `progression`. So “next stage” means harder vocabulary on the next discovery.
- **Popup “Next stage”**: sends `TRIGGER_PLANNER` with `debug_increment` (and ensures structural translations), then tells the **active tab** to run discovery now (`RUN_PAGE_DISCOVERY_NOW`) so the current page is re-processed at the new tier without a reload.

---

## Structural phrases and one-time translation

- **Structural phrases** are a fixed English list in `src/shared/structuralPhrases.ts` (e.g. “this is”, “however”, “for example”) with a **tier** (1–3). `getActivePhrases(tier)` returns those with `phrase.tier <= tier`.
- On first use (empty bank) or when switching language, **ENSURE_STRUCTURAL_TRANSLATIONS** runs in the background: for the current language, it finds structural phrases not yet in the bank, calls the LLM **once** to translate them all to the target language, then appends them to the bank. So structural phrases are translated once per language and cached.

---

## User actions and messaging

- **Popup**: language change → persist user context, `ENSURE_STRUCTURAL_TRANSLATIONS`. “Next stage” → `TRIGGER_PLANNER` (debug_increment) + `RUN_PAGE_DISCOVERY_NOW` to active tab. “Reset stage” → `TRIGGER_PLANNER` (debug_decrement). “Reset This Language” → confirm then `RESET_LANGUAGE_DATA` (clears bank and processed URLs for that language, then re-seeds structural translations). Progression threshold slider → `UPDATE_PROGRESSION_CONFIG`. Page toggle → `setPageDisabled` + optional reload.
- **Content script**: On load → Path A then Path B (if not disabled). On storage change (bank or user context) → re-run Path A and optionally Path B; on user context change, re-init selection player and clear output. **Selection “+ Learn”**: sends **ADD_PHRASE_TO_BANK** with selected text; background translates via LLM (plain text), adds one phrase (structural if in structural list, else lexical), saves bank, sends **BANK_READY** to the tab so replacements update immediately.
- **Router** (`src/background/messaging/router.ts`): Handles GET_BANK, RECORD_EXPOSURE, RECORD_HOVER_DECAY, CHECK_PROGRESSION, TRIGGER_PLANNER, ENSURE_STRUCTURAL_TRANSLATIONS, RUN_PAGE_DISCOVERY, RESET_LANGUAGE_DATA, ADD_PHRASE_TO_BANK, FETCH_DEFINITION, UPDATE_PROGRESSION_CONFIG, REQUEST_AUDIO, REPORT_PAGE_SIGNAL. Only GET_BANK, FETCH_DEFINITION, REQUEST_AUDIO, ADD_PHRASE_TO_BANK need `return true` for async `sendResponse`.

---

## Overlays (content script)

- **Tooltip** (`tooltipManager.ts`): On hover over a gloss span, shows translation, pronunciation (TTS) button, and a **confidence bar** that decays visually (and optionally in data via RECORD_HOVER_DECAY) to discourage over-revealing. Uses Web Speech API for TTS; language comes from the current user target language.
- **Selection player** (`selectionPlayer.ts`): On text selection, shows a “+ Learn” button. On click, sends ADD_PHRASE_TO_BANK; on success, button shows the translated phrase and the player hides after a short delay.
- **Audio** (`audioPlayer.ts`): Web Speech API for pronunciation; respects the current target language.

---

## External services

- **Gemini** (primary): Used for structural translation batch, page discovery (5–8 phrases), add-phrase translation, and fetch definition. Prompt length for discovery is capped (e.g. 6k chars) to avoid single-phrase responses.
- **Groq**: Fallback for the same LLM-style calls if Gemini fails.
- **Backboard**: Used **only for memory**. On extension suspend, the background builds a short narrative (learner level, phrase counts, consolidated/reinforcing/struggling phrases) and sends it to Backboard. **Not** used in discovery or in any prompt context for the LLM.
- **ElevenLabs**: Optional TTS; content script can use Web Speech as primary or fallback.

---

## Disabled pages and reading pipeline

- **Page disable**: Some URLs can be marked “paused” (stored in `glossDisabledPages`). The content script skips Path A/B when the page is disabled; the popup shows “Pause on this page” / “Enable on this page” for toggleable (http(s)) URLs.
- **Reading pipeline**: `extractParagraphs` (parser) yields paragraphs with text and **domPath**; `enrichPageContent` adds domain/page-type metadata. **Output** module applies replacement instructions by resolving domPath, clearing old gloss nodes, and inserting new spans with the correct attributes and classes; viewport animation can reveal them on scroll.

---

## Important files (by role)

| Role | Path |
|------|------|
| Extension entry, message listener, Backboard sync on suspend | `src/background/index.ts` |
| All background message handlers | `src/background/messaging/router.ts` |
| Tier, structural translation, page discovery, JSON parse/repair | `src/background/agent/planner.ts` |
| Phrase bank load/save, progression config, exposure/hover, progression trigger, reset | `src/background/memory/bankStore.ts` |
| User context load/save, Backboard narrative build | `src/background/memory/store.ts` |
| Gemini / Groq / Backboard / ElevenLabs | `src/background/api/*.ts` |
| Content boot, Path A/B, bank listener, discovery trigger | `src/content/index.ts` |
| Tooltip, confidence decay UI | `src/content/overlay/tooltipManager.ts` |
| Selection “+ Learn” and TTS | `src/content/overlay/selectionPlayer.ts`, `audioPlayer.ts` |
| Apply/clear replacements, viewport animation | `src/content/output/index.ts`, `renderer.ts` |
| Paragraph extraction, enricher | `src/content/reader/parser.ts`, `enricher.ts` |
| Shared types, messages, structural list, bank snapshot, page disable, languages | `src/shared/*.ts` |
| Popup UI | `src/popup/App.tsx` |
| Options/dashboard | `src/dashboard/` |

---

## Config and env

- **Progression** (threshold, confidence gain/decay, hover decay) in `glossProgressionConfig` (storage) and defaults in `bankStore.ts`.
- **User context** (CEFR band, target/native language, etc.) in `userContext` (storage).
- API keys / Backboard config via `import.meta.env` (e.g. `VITE_GEMINI_API_KEY`, `VITE_BACKBOARD_API_KEY`).

---

## Testing and build

- `npm run build` → Vite build; output in `dist/` with manifest and content/background scripts.
- `npx tsc --noEmit` for type-checking.
- Tests in `tests/` (e.g. output renderer, viewport, integration).

This document is the **comprehensive context** of the project in text form for onboarding or AI assistants.
