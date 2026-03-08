import { GLOSS_WRAPPER_CLASS } from "@/content/output";
import type { ProgressionConfig } from "@/shared/types";

const hoverTimers = new Map<string, ReturnType<typeof setTimeout>>();
let tooltipEl: HTMLElement | null = null;
let activeSpan: HTMLElement | null = null;
let activeConfig: ProgressionConfig | null = null;
let listenersBound = false;

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
    pointer-events: none;
    display: none;
    transition: opacity 0.15s ease;
  `;
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
  getTooltipEl().style.display = "none";
  activeSpan = null;
}

function showTooltip(span: HTMLElement): void {
  const tooltip = getTooltipEl();
  const foreignPhrase = span.textContent ?? "";
  const originalPhrase = span.getAttribute("data-gloss-source") ?? "";
  const confidence = parseFloat(span.getAttribute("data-gloss-confidence") ?? "0");
  const phraseType = span.getAttribute("data-gloss-phrase-type") ?? "structural";
  const language = span.getAttribute("data-gloss-language") ?? "es";
  const filledDots = Math.round(confidence * 5);
  const dots = Array.from({ length: 5 }, (_, index) => {
    const color = index < filledDots ? "rgba(251, 191, 36, 1)" : "rgba(251, 191, 36, 0.2)";
    return `<span style="color:${color}">●</span>`;
  }).join("");
  const isStructural = phraseType === "structural";

  tooltip.innerHTML = `
    <div style="font-size:16px;font-weight:600;color:#1f2937">${foreignPhrase}</div>
    <div data-def style="color:#374151;margin-top:4px;${isStructural ? "" : "font-style:italic;"}">
      ${isStructural ? originalPhrase : "loading definition..."}
    </div>
    <div style="margin-top:8px;display:flex;gap:2px;align-items:center">
      ${dots}
      <span style="margin-left:6px;font-size:11px;color:#9ca3af">${Math.round(confidence * 100)}%</span>
    </div>
  `;

  const rect = span.getBoundingClientRect();
  const tipX = Math.min(rect.left + rect.width / 2 - 120, window.innerWidth - 256);
  tooltip.style.left = `${Math.max(8, tipX)}px`;
  tooltip.style.top = `${rect.top - 8}px`;
  tooltip.style.display = "block";

  const tipRect = tooltip.getBoundingClientRect();
  if (tipRect.top < 8) {
    tooltip.style.top = `${rect.bottom + 8}px`;
  }

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

  const timer = window.setTimeout(() => {
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
  }, config.hoverDecayThresholdMs);

  hoverTimers.set(phraseId, timer);
}

function handleMouseOut(event: MouseEvent): void {
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

  hideTooltip();
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
