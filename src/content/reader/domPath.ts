function cssEscape(value: string): string {
  if (typeof window.CSS !== "undefined" && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return value.replace(/([^\w-])/g, "\\$1");
}

export function buildDomPath(element: Element): string {
  if (element.id) {
    const escaped = cssEscape(element.id);
    const idPath = `#${escaped}`;
    if (document.querySelectorAll(idPath).length === 1) return idPath;
  }

  const segments: string[] = [];
  let cursor: Element | null = element;
  while (cursor && cursor !== document.documentElement) {
    const tag = cursor.tagName.toLowerCase();
    const parent: Element | null = cursor.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(cursor) + 1;
    segments.unshift(`${tag}:nth-child(${index})`);
    cursor = parent;
  }
  segments.unshift("html");
  return segments.join(" > ");
}

export function resolveDomPath(path: string): Element | null {
  return document.querySelector(path);
}

