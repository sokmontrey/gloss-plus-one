import { GLOSS_WRAPPER_CLASS } from "@/content/output";
import { isPlaying, requestAndPlay, stopPlaying } from "./audioPlayer";

let tooltipEl: HTMLElement | null = null;
let activeSpan: HTMLElement | null = null;
let listenersBound = false;
let hideTimer: ReturnType<typeof window.setTimeout> | null = null;
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

  tooltip.innerHTML = `
    <div style="font-size:16px;font-weight:600;color:#1f2937">${escapeHtml(pronunciation)}</div>
    <div style="margin-top:6px;color:#374151">
      <strong>Translation:</strong> ${escapeHtml(translation)}
    </div>
    <div style="margin-top:4px;color:#6b7280">
      <strong>Pronunciation:</strong> ${escapeHtml(pronunciation)}
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

  scheduleHideTooltip();
}

export function initHoverListeners(): void {
  if (listenersBound) {
    return;
  }

  document.addEventListener("mouseover", handleMouseOver);
  document.addEventListener("mouseout", handleMouseOut);
  listenersBound = true;
}
