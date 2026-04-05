import type { ExtractionResult, TextBlock } from './types'

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'SVG',
  'CANVAS',
  'TEMPLATE',
])

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'TD',
  'TH',
  'BLOCKQUOTE',
  'PRE',
  'ARTICLE',
  'SECTION',
  'HEADER',
  'FOOTER',
  'MAIN',
  'NAV',
  'ASIDE',
  'FIGCAPTION',
])

export function extractPageText(root: Element = document.body): ExtractionResult {
  const blocks = discoverBlockElements(root)
    .map((block) => extractBlockText(block, root))
    .filter((block): block is TextBlock => block !== null)

  const totalChars = blocks.reduce((count, block) => count + block.text.length, 0)

  return {
    url: window.location.href,
    title: document.title,
    extractedAt: new Date().toISOString(),
    blocks,
    stats: {
      totalBlocks: blocks.length,
      totalChars,
    },
  }
}

export function discoverBlockElements(root: Element): Element[] {
  const blocks: Element[] = []
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return acceptsTextNode(node, root)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof Text) || !node.parentElement) continue

    const block = getBlockAncestor(node.parentElement, root)
    if (seen.has(block)) continue

    seen.add(block)
    blocks.push(block)
  }

  return blocks
}

export function extractBlockText(block: Element, root: Element): TextBlock | null {
  const fragments: string[] = []
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!acceptsTextNode(node, root)) return NodeFilter.FILTER_REJECT
      if (!(node instanceof Text) || !node.parentElement) return NodeFilter.FILTER_REJECT

      return getBlockAncestor(node.parentElement, root) === block
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof Text)) continue

    const text = normalizeWhitespace(node.textContent ?? '')
    if (text) {
      fragments.push(text)
    }
  }

  if (fragments.length === 0) return null

  return {
    text: fragments.join(' '),
    tagName: block.tagName,
    path: getElementPath(block, root),
  }
}

function acceptsTextNode(node: Node, root: Element): boolean {
  if (!(node instanceof Text)) return false

  const text = normalizeWhitespace(node.textContent ?? '')
  if (!text) return false

  const parent = node.parentElement
  if (!parent || isIgnoredNode(parent, root)) return false

  return true
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function isIgnoredNode(element: Element, root: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (SKIP_TAGS.has(current.tagName)) return true
    if (current.hasAttribute('hidden')) return true
    if (current.getAttribute('aria-hidden') === 'true') return true

    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current)
      if (style.display === 'none' || style.visibility === 'hidden') return true
    }

    if (current === root) break
  }

  return false
}

function getBlockAncestor(element: Element, root: Element): Element {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (BLOCK_TAGS.has(current.tagName) || current === root) {
      return current
    }
  }

  return root
}

function getElementPath(element: Element, root: Element): string {
  const parts: string[] = []

  for (let current: Element | null = element; current; current = current.parentElement) {
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
      : [current]
    const index = siblings.indexOf(current)

    parts.push(`${current.tagName}[${Math.max(index, 0)}]`)

    if (current === root) break
  }

  return parts.reverse().join('/')
}
