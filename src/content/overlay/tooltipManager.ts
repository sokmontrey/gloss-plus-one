import { GLOSS_WRAPPER_CLASS } from "@/content/output";
import type { ProgressionConfig } from "@/shared/types";
import { isPlaying, requestAndPlay, stopPlaying } from "./audioPlayer";

const CONFIG_KEY = "glossProgressionConfig";
const DEFAULT_HOVER_CONFIG: Pick<
  ProgressionConfig,
  "confidenceDecayPerHover" | "hoverDecayThresholdMs"
> = {
  confidenceDecayPerHover: 0.12,
  hoverDecayThresholdMs: 2000,
};

const hoverTimers = new Map<string, ReturnType<typeof window.setTimeout>>();
const decayedPhraseIds = new Set<string>();

let tooltipEl: HTMLElement | null = null;
let activeSpan: HTMLElement | null = null;
let listenersBound = false;
let hideTimer: ReturnType<typeof window.setTimeout> | null = null;
let hoverEnabled = true;
let hoverConfig = { ...DEFAULT_HOVER_CONFIG };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getConfidenceTone(confidence: number): {
  fill: string;
  text: string;
  glow: string;
} {
  if (confidence >= 0.75) {
    return {
      fill: "linear-gradient(90deg, rgba(34,197,94,0.95), rgba(132,204,22,0.95))",
      text: "#3f6212",
      glow: "rgba(132, 204, 22, 0.25)",
    };
  }

  if (confidence >= 0.45) {
    return {
      fill: "linear-gradient(90deg, rgba(245,158,11,0.95), rgba(251,191,36,0.95))",
      text: "#92400e",
      glow: "rgba(251, 191, 36, 0.24)",
    };
  }

  return {
    fill: "linear-gradient(90deg, rgba(244,63,94,0.95), rgba(251,113,133,0.95))",
    text: "#be123c",
    glow: "rgba(251, 113, 133, 0.22)",
  };
}

function clearHoverTimers(): void {
  for (const timer of hoverTimers.values()) {
    clearTimeout(timer);
  }
  hoverTimers.clear();
}

function syncHoverConfig(): void {
  void chrome.storage.local.get(CONFIG_KEY).then((result) => {
    const stored = result[CONFIG_KEY] as Partial<ProgressionConfig> | undefined;
    hoverConfig = {
      confidenceDecayPerHover: stored?.confidenceDecayPerHover ?? DEFAULT_HOVER_CONFIG.confidenceDecayPerHover,
      hoverDecayThresholdMs: stored?.hoverDecayThresholdMs ?? DEFAULT_HOVER_CONFIG.hoverDecayThresholdMs,
    };
  });
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
    max-width: 260px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    font-family: system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    pointer-events: auto;
    display: none;
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

    const pronunciation = activeSpan?.textContent ?? button.getAttribute("data-text") ?? "";
    const language = activeSpan?.getAttribute("data-gloss-language") ?? button.getAttribute("data-language") ?? "es";
    const label = button.querySelector("#gloss-speaker-label");

    if (isPlaying()) {
      stopPlaying();
      if (label instanceof HTMLElement) {
        label.textContent = "Listen";
      }
      return;
    }

    requestAndPlay(
      pronunciation,
      language,
      () => {
        if (label instanceof HTMLElement) {
          label.textContent = "...";
        }
      },
      () => {
        if (label instanceof HTMLElement) {
          label.textContent = isPlaying() ? "Stop" : "Listen";
        }
      },
    );
  });
  el.addEventListener("mouseenter", () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });
  el.addEventListener("mouseleave", scheduleHideTooltip);
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
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleHideTooltip(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  hideTimer = window.setTimeout(hideTooltip, 120);
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

  const pronunciation = span.textContent ?? "";
  const translation = span.getAttribute("data-gloss-source") ?? "";
  const language = span.getAttribute("data-gloss-language") ?? "es";
  const currentConfidence = clampConfidence(
    Number.parseFloat(span.getAttribute("data-gloss-confidence") ?? "0"),
  );
  const projectedConfidence = clampConfidence(currentConfidence - hoverConfig.confidenceDecayPerHover);
  const confidenceTone = getConfidenceTone(currentConfidence);
  const projectedTone = getConfidenceTone(projectedConfidence);

  tooltip.innerHTML = `
    <div style="font-size:16px;font-weight:600;color:#1f2937">${escapeHtml(pronunciation)}</div>
    <div style="margin-top:6px;color:#374151">
      <strong>Translation:</strong> ${escapeHtml(translation)}
    </div>
    <div style="margin-top:4px;color:#6b7280">
      <strong>Pronunciation:</strong> ${escapeHtml(pronunciation)}
    </div>
    <div style="margin-top:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:11px;font-weight:600;color:#6b7280">Confidence</span>
        <span
          data-confidence-value
          style="font-size:11px;font-weight:700;color:${confidenceTone.text};transition:color 180ms ease"
        >
          ${Math.round(currentConfidence * 100)}%
        </span>
      </div>
      <div
        style="
          position:relative;
          overflow:hidden;
          margin-top:6px;
          height:6px;
          border-radius:999px;
          background:rgba(148,163,184,0.18);
        "
      >
        <div
          data-confidence-fill
          style="
            height:100%;
            width:${Math.round(currentConfidence * 100)}%;
            border-radius:999px;
            background:${confidenceTone.fill};
            box-shadow:0 0 0 1px ${confidenceTone.glow};
            transition:
              width ${hoverConfig.hoverDecayThresholdMs}ms linear,
              background 220ms ease,
              box-shadow 220ms ease;
          "
        ></div>
      </div>
      <div
        data-confidence-note
        style="
          margin-top:5px;
          font-size:10px;
          color:#94a3b8;
          transition:color 220ms ease;
        "
      >
        Long hover reduces this phrase by ${Math.round(hoverConfig.confidenceDecayPerHover * 100)}%.
      </div>
    </div>
    <button
      id="gloss-speaker-btn"
      data-text="${escapeHtml(pronunciation)}"
      data-language="${escapeHtml(language)}"
      style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 4px 10px;
        background: rgba(251,191,36,0.12);
        border: 1px solid rgba(251,191,36,0.4);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        color: #92400e;
        font-family: system-ui;
      "
    >
      🔊 <span id="gloss-speaker-label">${isPlaying() ? "Stop" : "Listen"}</span>
    </button>
  `;

  const rect = span.getBoundingClientRect();
  const tooltipWidth = 260;
  const tooltipGap = 8;
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  left = Math.max(tooltipGap, Math.min(left, window.innerWidth - tooltipWidth - tooltipGap));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(tooltipGap, rect.top - tooltipGap)}px`;
  tooltip.style.display = "block";

  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    if (tipRect.top < tooltipGap) {
      tooltip.style.top = `${rect.bottom + tooltipGap}px`;
    }

    const fillEl = tooltip.querySelector("[data-confidence-fill]");
    const valueEl = tooltip.querySelector("[data-confidence-value]");
    const noteEl = tooltip.querySelector("[data-confidence-note]");
    if (
      fillEl instanceof HTMLElement &&
      valueEl instanceof HTMLElement &&
      noteEl instanceof HTMLElement &&
      !decayedPhraseIds.has(span.getAttribute("data-gloss-phrase-id") ?? "")
    ) {
      fillEl.style.width = `${Math.round(projectedConfidence * 100)}%`;
      fillEl.style.background = projectedTone.fill;
      fillEl.style.boxShadow = `0 0 0 1px ${projectedTone.glow}`;
      valueEl.style.color = projectedTone.text;
      noteEl.style.color = projectedTone.text;
    }
  });
}

function applyDecayToSpan(span: HTMLElement): void {
  const phraseId = span.getAttribute("data-gloss-phrase-id");
  if (!phraseId || decayedPhraseIds.has(phraseId)) {
    return;
  }

  decayedPhraseIds.add(phraseId);
  const currentConfidence = clampConfidence(
    Number.parseFloat(span.getAttribute("data-gloss-confidence") ?? "0"),
  );
  const nextConfidence = clampConfidence(currentConfidence - hoverConfig.confidenceDecayPerHover);
  span.setAttribute("data-gloss-confidence", String(nextConfidence));
  span.style.setProperty("--gloss-confidence", String(nextConfidence));

  const tooltip = getTooltipEl();
  const fillEl = tooltip.querySelector("[data-confidence-fill]");
  const valueEl = tooltip.querySelector("[data-confidence-value]");
  const noteEl = tooltip.querySelector("[data-confidence-note]");
  const tone = getConfidenceTone(nextConfidence);
  if (fillEl instanceof HTMLElement) {
    fillEl.style.width = `${Math.round(nextConfidence * 100)}%`;
    fillEl.style.background = tone.fill;
    fillEl.style.boxShadow = `0 0 0 1px ${tone.glow}`;
  }
  if (valueEl instanceof HTMLElement) {
    valueEl.textContent = `${Math.round(nextConfidence * 100)}%`;
    valueEl.style.color = tone.text;
  }
  if (noteEl instanceof HTMLElement) {
    noteEl.textContent = `Confidence dropped after the hover reveal.`;
    noteEl.style.color = tone.text;
  }

  void chrome.runtime.sendMessage({
    type: "RECORD_HOVER_DECAY",
    payload: {
      phraseId,
      language: span.getAttribute("data-gloss-language") ?? "es",
    },
  });
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

  activeSpan = span;
  showTooltip(span);

  const phraseId = span.getAttribute("data-gloss-phrase-id");
  if (!phraseId || decayedPhraseIds.has(phraseId)) {
    return;
  }

  const existingTimer = hoverTimers.get(phraseId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  hoverTimers.set(
    phraseId,
    window.setTimeout(() => {
      hoverTimers.delete(phraseId);
      applyDecayToSpan(span);
    }, hoverConfig.hoverDecayThresholdMs),
  );
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

  const relatedTarget = event.relatedTarget;
  if (relatedTarget instanceof Element && relatedTarget.closest("#gloss-tooltip")) {
    return;
  }

  const phraseId = span.getAttribute("data-gloss-phrase-id");
  if (phraseId) {
    const timer = hoverTimers.get(phraseId);
    if (timer) {
      clearTimeout(timer);
      hoverTimers.delete(phraseId);
    }
  }

  scheduleHideTooltip();
}

export function initHoverListeners(): void {
  if (listenersBound) {
    return;
  }

  syncHoverConfig();
  document.addEventListener("mouseover", handleMouseOver);
  document.addEventListener("mouseout", handleMouseOut);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[CONFIG_KEY]) {
      return;
    }
    syncHoverConfig();
  });
  listenersBound = true;
}
