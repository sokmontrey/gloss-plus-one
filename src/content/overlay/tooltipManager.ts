import { GLOSS_WRAPPER_CLASS } from "@/content/output";
import type { ProgressionConfig } from "@/shared/types";
import { isPlaying, requestAndPlay, stopPlaying } from "./audioPlayer";

const hoverTimers = new Map<string, ReturnType<typeof setTimeout>>();
const decayedPhraseIds = new Set<string>();
let tooltipEl: HTMLElement | null = null;
let activeSpan: HTMLElement | null = null;
let activeConfig: ProgressionConfig | null = null;
let listenersBound = false;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let hoverEnabled = true;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createTooltipEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "gloss-tooltip";
  el.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: white;
    border: 1px solid rgba(251, 191, 36, 0.5);
    border-radius: 8px;
    padding: 10px 14px;
    max-width: 240px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    font-family: system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    pointer-events: auto;
    display: none;
    transition: opacity 0.15s ease;
  `;
  el.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("#gloss-speaker-btn");
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const text = activeSpan?.textContent ?? button.getAttribute("data-text") ?? "";
    const language = activeSpan?.getAttribute("data-gloss-language") ?? button.getAttribute("data-language") ?? "es";
    const label = button.querySelector("#gloss-speaker-label");

    if (isPlaying()) {
      stopPlaying();
      if (label instanceof HTMLElement) {
        label.textContent = "Listen";
      }
      button.style.opacity = "1";
      return;
    }

    requestAndPlay(
      text,
      language,
      () => {
        if (label instanceof HTMLElement) {
          label.textContent = "...";
        }
        button.style.opacity = "0.6";
      },
      () => {
        if (label instanceof HTMLElement) {
          label.textContent = isPlaying() ? "⏹ Stop" : "Listen";
        }
        button.style.opacity = "1";
      },
    );
  });
  el.addEventListener("mouseenter", () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });
  el.addEventListener("mouseleave", () => {
    scheduleHideTooltip();
  });
  document.body.appendChild(el);
  return el;
}

function getTooltipEl(): HTMLElement {
  if (tooltipEl?.isConnected) {
    return tooltipEl;
  }

  tooltipEl = createTooltipEl();
  return tooltipEl;
}

function hideTooltip(): void {
  const tooltip = getTooltipEl();
  tooltip.style.display = "none";
  activeSpan = null;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleHideTooltip(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }

  hideTimer = window.setTimeout(() => {
    hideTooltip();
  }, 120);
}

function clearHoverTimers(): void {
  for (const timer of hoverTimers.values()) {
    clearTimeout(timer);
  }

  hoverTimers.clear();
}

export function setHoverListenersEnabled(enabled: boolean): void {
  hoverEnabled = enabled;

  if (!enabled) {
    clearHoverTimers();
    hideTooltip();
  }
}

function showTooltip(span: HTMLElement): void {
  const tooltip = getTooltipEl();
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const foreignPhrase = span.textContent ?? "";
  const originalPhrase = span.getAttribute("data-gloss-source") ?? "";
  const rawConfidence = parseFloat(span.getAttribute("data-gloss-confidence") ?? "0");
  const confidence = Number.isFinite(rawConfidence) ? rawConfidence : 0;
  const phraseType = span.getAttribute("data-gloss-phrase-type") ?? "structural";
  const language = span.getAttribute("data-gloss-language") ?? "es";
  const filledDots = Math.round(confidence * 5);
  const dots = Array.from({ length: 5 }, (_, index) => {
    const color = index < filledDots ? "rgba(251, 191, 36, 1)" : "rgba(251, 191, 36, 0.2)";
    return `<span style="color:${color}">●</span>`;
  }).join("");
  const isStructural = phraseType === "structural";
  const speakerButton = `
    <button
      id="gloss-speaker-btn"
      data-text="${escapeHtml(foreignPhrase)}"
      data-language="${escapeHtml(language)}"
      style="
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        padding: 4px 10px;
        background: rgba(251,191,36,0.12);
        border: 1px solid rgba(251,191,36,0.4);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        color: #92400e;
        font-family: system-ui;
        transition: background 0.15s ease;
      "
    >
      🔊 <span id="gloss-speaker-label">${isPlaying() ? "⏹ Stop" : "Listen"}</span>
    </button>
  `;

  tooltip.innerHTML = `
    <div style="font-size:16px;font-weight:600;color:#1f2937">${escapeHtml(foreignPhrase)}</div>
    <div data-def style="color:#374151;margin-top:4px;${isStructural ? "" : "font-style:italic;"}">
      ${isStructural ? escapeHtml(originalPhrase) : "loading definition..."}
    </div>
    ${speakerButton}
    <div style="margin-top:8px;display:flex;gap:2px;align-items:center">
      ${dots}
      <span style="margin-left:6px;font-size:11px;color:#9ca3af">${Math.round(confidence * 100)}%</span>
    </div>
  `;

  const rect = span.getBoundingClientRect();
  const TOOLTIP_WIDTH = 240;
  const TOOLTIP_GAP = 8;

  let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(TOOLTIP_GAP, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_GAP));

  const top = rect.top - TOOLTIP_GAP;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.display = "block";

  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    if (tipRect.top < TOOLTIP_GAP) {
      tooltip.style.top = `${rect.bottom + TOOLTIP_GAP}px`;
    }
  });

  if (!isStructural) {
    fetchDefinition(
      span.getAttribute("data-gloss-phrase-id") ?? "",
      foreignPhrase,
      originalPhrase,
      language,
    );
  }
}

function fetchDefinition(
  phraseId: string,
  foreignPhrase: string,
  originalPhrase: string,
  language: string,
): void {
  chrome.runtime.sendMessage(
    {
      type: "FETCH_DEFINITION",
      payload: { phraseId, foreignPhrase, originalPhrase, language },
    },
    (response?: { definition?: string }) => {
      if (!response?.definition || !activeSpan || getTooltipEl().style.display === "none") {
        return;
      }

      const activePhraseId = activeSpan.getAttribute("data-gloss-phrase-id") ?? "";
      if (activePhraseId !== phraseId) {
        return;
      }

      const definitionEl = getTooltipEl().querySelector("[data-def]");
      if (definitionEl instanceof HTMLElement) {
        definitionEl.textContent = response.definition;
      }
    },
  );
}

function handleMouseOver(event: MouseEvent): void {
  if (!hoverEnabled) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const span = target.closest(`.${GLOSS_WRAPPER_CLASS}`);
  if (!(span instanceof HTMLElement)) {
    return;
  }

  const phraseId = span.getAttribute("data-gloss-phrase-id");
  if (!phraseId || !activeConfig) {
    return;
  }

  const config = activeConfig;
  activeSpan = span;
  showTooltip(span);

  const existingTimer = hoverTimers.get(phraseId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  if (decayedPhraseIds.has(phraseId)) {
    hoverTimers.delete(phraseId);
    return;
  }

  const timer = window.setTimeout(() => {
    decayedPhraseIds.add(phraseId);
    void chrome.runtime.sendMessage({
      type: "RECORD_HOVER_DECAY",
      payload: {
        phraseId,
        language: span.getAttribute("data-gloss-language") ?? "es",
      },
    });

    const currentConfidence = parseFloat(span.getAttribute("data-gloss-confidence") ?? "0");
    const nextConfidence = Math.max(currentConfidence - config.confidenceDecayPerHover, 0);
    span.setAttribute("data-gloss-confidence", String(nextConfidence));
    span.style.setProperty("--gloss-confidence", String(nextConfidence));
    hoverTimers.delete(phraseId);
  }, config.hoverDecayThresholdMs);

  hoverTimers.set(phraseId, timer);
}

function handleMouseOut(event: MouseEvent): void {
  if (!hoverEnabled) {
    hideTooltip();
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const span = target.closest(`.${GLOSS_WRAPPER_CLASS}`);
  if (!(span instanceof HTMLElement)) {
    return;
  }

  const phraseId = span.getAttribute("data-gloss-phrase-id");
  if (!phraseId) {
    return;
  }

  const timer = hoverTimers.get(phraseId);
  if (timer) {
    clearTimeout(timer);
    hoverTimers.delete(phraseId);
  }

  const relatedTarget = event.relatedTarget;
  if (relatedTarget instanceof Element && relatedTarget.closest("#gloss-tooltip")) {
    return;
  }

  scheduleHideTooltip();
}

export function initHoverListeners(
  config: ProgressionConfig,
  targetLanguage: string,
  nativeLanguage: string,
  phase: "structural" | "lexical",
): void {
  activeConfig = config;
  void targetLanguage;
  void nativeLanguage;
  void phase;

  if (listenersBound) {
    return;
  }

  document.addEventListener("mouseover", handleMouseOver);
  document.addEventListener("mouseout", handleMouseOut);
  listenersBound = true;
}
