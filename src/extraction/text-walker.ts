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
  const blocks: TextBlock[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT

      const text = normalizeWhitespace(node.textContent ?? '')
      if (!text) return NodeFilter.FILTER_REJECT

      const parent = node.parentElement
      if (!parent || isIgnoredNode(parent, root)) return NodeFilter.FILTER_REJECT

      return NodeFilter.FILTER_ACCEPT
    },
  })

  let currentBlock: TextBlock | null = null
  let currentElement: Element | null = null
  let totalChars = 0

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof Text) || !node.parentElement) continue

    const text = normalizeWhitespace(node.textContent ?? '')
    if (!text) continue

    const blockElement = getBlockAncestor(node.parentElement, root)
    const path = getElementPath(blockElement, root)

    if (currentBlock && currentElement === blockElement) {
      currentBlock.text = `${currentBlock.text} ${text}`
    } else {
      currentBlock = {
        text,
        tagName: blockElement.tagName,
        path,
      }
      currentElement = blockElement
      blocks.push(currentBlock)
    }

    totalChars += text.length
  }

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
