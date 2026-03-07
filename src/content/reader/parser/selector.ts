const INCLUDE_SELECTOR = "article, main, section, p, h1, h2, h3";
const EXCLUDE_SELECTOR =
  "nav, footer, header, aside, [role='banner'], [role='navigation']";

const TAG_WEIGHT: Record<string, number> = {
  article: 1,
  main: 0.9,
  section: 0.75,
  p: 0.7,
  h1: 0.5,
  h2: 0.45,
  h3: 0.4,
};

function countWords(text: string): number {
  return (text.match(/\b[\p{L}]+(?:['’-][\p{L}]+)*\b/gu) ?? []).length;
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

export interface SelectorOptions {
  root?: ParentNode;
  minWordCount?: number;
  maxCandidates?: number;
}

export function selectCandidateElements(options: SelectorOptions = {}): Element[] {
  const root = options.root ?? document;
  const minWordCount = options.minWordCount ?? 20;
  const maxCandidates = options.maxCandidates ?? 50;
  const nodes = Array.from(root.querySelectorAll(INCLUDE_SELECTOR));
  const viewportHeight = window.innerHeight || 1000;

  const scored = nodes
    .filter((el) => !el.closest(EXCLUDE_SELECTOR) && !el.matches(EXCLUDE_SELECTOR))
    .map((el) => {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      const words = countWords(text);
      const descendants = el.querySelectorAll("*").length || 1;
      const density = words / descendants;
      const top = el.getBoundingClientRect().top;
      const posNorm = clamp(1 - Math.abs(top - viewportHeight * 0.5) / viewportHeight, 0, 1);
      const tag = el.tagName.toLowerCase();
      const tagWeight = TAG_WEIGHT[tag] ?? 0.3;
      return {
        el,
        words,
        score: words * 0.5 + density * 8 + posNorm * 8 + tagWeight * 6,
      };
    })
    .filter((row) => row.words >= minWordCount)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxCandidates).map((row) => row.el);
}

