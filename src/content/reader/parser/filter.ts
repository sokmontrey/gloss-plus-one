export interface ParagraphFilterOptions {
  minWords?: number;
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*/i;
const CODE_RE =
  /```|<\/?[a-z][\w-]*>|^\s*(?:const|let|var|function|class|if|for|while|return|import|export)\b/m;

function wordCount(text: string): number {
  return (text.match(/\b[\p{L}]+(?:['’-][\p{L}]+)*\b/gu) ?? []).length;
}

function heavyRatio(text: string): number {
  const chars = text.replace(/\s/g, "");
  if (!chars.length) return 1;
  const heavy = (chars.match(/[\d\p{P}\p{S}]/gu) ?? []).length;
  return heavy / chars.length;
}

function isAllCaps(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 10) return false;
  const upper = letters.filter((c) => c === c.toUpperCase()).length;
  return upper / letters.length >= 0.95;
}

function looksLikeNavOrMeta(text: string): boolean {
  if (/^\s*(by|updated|published)\b/i.test(text)) return true;
  const chunks = text.split(/[|/>»•]+/).map((c) => c.trim()).filter(Boolean);
  return chunks.length >= 5 && chunks.every((c) => c.split(/\s+/).length <= 3);
}

export function isReadableParagraph(rawText: string, options: ParagraphFilterOptions = {}): boolean {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (URL_RE.test(text)) return false;
  if (wordCount(text) < (options.minWords ?? 10)) return false;
  if (heavyRatio(text) > 0.5) return false;
  if (isAllCaps(text)) return false;
  if (CODE_RE.test(text)) return false;
  if (looksLikeNavOrMeta(text)) return false;
  return true;
}

