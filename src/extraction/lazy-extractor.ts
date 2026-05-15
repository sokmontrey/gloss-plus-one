import { discoverBlockElements, extractBlockText } from './text-walker'
import type {
  ExtractionBatch,
  ExtractionResult,
  LazyExtractionConfig,
  TextBlock,
} from './types'

const DEFAULT_CONFIG: LazyExtractionConfig = {
  rootMargin: '200px',
  minBlockChars: 1,
  mutationDebounceMs: 150,
  maxBlocksPerBatch: 5,
}

export class LazyExtractor {
  private readonly config: LazyExtractionConfig
  private readonly onBatch: (batch: ExtractionBatch) => void

  private root: Element | null = null
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObserver: MutationObserver | null = null
  private mutationTimer: number | null = null

  private extractedElements = new WeakSet<Element>()
  private extractedPaths = new Set<string>()
  private accumulatedBlocks: TextBlock[] = []
  private batchIndex = 0
  private cumulativeChars = 0
  private nextSequence = 0

  constructor(
    config: Partial<LazyExtractionConfig> = {},
    onBatch: (batch: ExtractionBatch) => void,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.onBatch = onBatch
  }

  start(root: Element = document.body): void {
    this.stop()

    this.root = root
    this.resetCaches()

    this.intersectionObserver = new IntersectionObserver(
      (entries) => this.handleIntersections(entries, 'viewport'),
      {
        root: null,
        rootMargin: this.config.rootMargin,
        threshold: 0,
      },
    )

    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.mutationTimer !== null) {
        window.clearTimeout(this.mutationTimer)
      }

      this.mutationTimer = window.setTimeout(() => {
        this.mutationTimer = null
        this.handleMutations(mutations)
      }, this.config.mutationDebounceMs)
    })

    this.mutationObserver.observe(root, {
      characterData: true,
      childList: true,
      subtree: true,
    })

    for (const element of discoverBlockElements(root)) {
      this.observeElement(element)
    }

    this.forceExtractVisible('viewport')
  }

  stop(): void {
    this.intersectionObserver?.disconnect()
    this.mutationObserver?.disconnect()

    if (this.mutationTimer !== null) {
      window.clearTimeout(this.mutationTimer)
      this.mutationTimer = null
    }

    this.intersectionObserver = null
    this.mutationObserver = null
    this.root = null
    this.resetCaches()
  }

  getAccumulatedResult(): ExtractionResult {
    return {
      url: window.location.href,
      title: document.title,
      extractedAt: new Date().toISOString(),
      blocks: [...this.accumulatedBlocks],
      stats: {
        totalBlocks: this.accumulatedBlocks.length,
        totalChars: this.cumulativeChars,
      },
    }
  }

  forceExtractVisible(trigger: ExtractionBatch['trigger'] = 'manual'): void {
    if (!this.root) return

    const visibleBlocks = discoverBlockElements(this.root).filter((element) =>
      this.isWithinViewportMargin(element),
    )

    this.processElements(visibleBlocks, trigger)
  }

  private handleIntersections(
    entries: IntersectionObserverEntry[],
    trigger: ExtractionBatch['trigger'],
  ): void {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .map((entry) => entry.target)
      .filter((target): target is Element => target instanceof Element)

    this.processElements(visibleEntries, trigger)
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.root) return

    const discovered: Element[] = []
    const seen = new Set<Element>()

    for (const mutation of mutations) {
      // Skip mutations caused by our own edit application
      if (this.isOwnEditMutation(mutation)) continue

      if (mutation.type === 'characterData' && mutation.target.parentElement) {
        const blocks = discoverBlockElements(mutation.target.parentElement)
        for (const block of blocks) {
          if (seen.has(block)) continue
          seen.add(block)
          discovered.push(block)
        }
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue

        const blocks = discoverBlockElements(node)
        for (const block of blocks) {
          if (seen.has(block)) continue
          seen.add(block)
          discovered.push(block)
        }
      }
    }

    for (const element of discovered) {
      this.observeElement(element)
    }

    this.processElements(
      discovered.filter((element) => this.isWithinViewportMargin(element)),
      'mutation',
      true,
    )
  }

  private processElements(
    elements: Element[],
    trigger: ExtractionBatch['trigger'],
    allowReprocess = false,
  ): void {
    if (!this.root || !this.intersectionObserver) return

    const blocks: TextBlock[] = []
    let batchChars = 0

    for (const element of elements) {
      if (this.extractedElements.has(element) && !allowReprocess) {
        this.intersectionObserver.unobserve(element)
        continue
      }

      this.extractedElements.add(element)
      this.intersectionObserver.unobserve(element)

      if (!element.isConnected) continue

      const block = extractBlockText(element, this.root, this.nextSequence)
      if (!block || block.text.length < this.config.minBlockChars) continue
      this.nextSequence += 1

      if (this.extractedPaths.has(block.path) && !allowReprocess) {
        continue
      }

      this.extractedPaths.add(block.path)
      this.accumulatedBlocks.push(block)
      this.cumulativeChars += block.text.length
      batchChars += block.text.length
      blocks.push(block)
    }

    if (blocks.length === 0) return

    // Send in small chunks so earlier blocks get processed while later ones are still queued
    const max = this.config.maxBlocksPerBatch
    for (let i = 0; i < blocks.length; i += max) {
      const chunk = blocks.slice(i, i + max)
      const chunkChars = chunk.reduce((sum, b) => sum + b.text.length, 0)

      this.batchIndex += 1
      this.onBatch({
        batchIndex: this.batchIndex,
        trigger,
        blocks: chunk,
        stats: {
          batchBlocks: chunk.length,
          batchChars: chunkChars,
          cumulativeBlocks: this.accumulatedBlocks.length,
          cumulativeChars: this.cumulativeChars,
        },
      })
    }
  }

  private observeElement(element: Element): void {
    if (!this.intersectionObserver || this.extractedElements.has(element)) return
    this.intersectionObserver.observe(element)
  }

  private isWithinViewportMargin(element: Element): boolean {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return false

    const margin = parseRootMargin(this.config.rootMargin)
    return (
      rect.bottom >= -margin.top
      && rect.top <= window.innerHeight + margin.bottom
      && rect.right >= -margin.left
      && rect.left <= window.innerWidth + margin.right
    )
  }

  private isOwnEditMutation(mutation: MutationRecord): boolean {
    // Edits insert <span data-gloss-plus-one-edit-id> elements
    for (const node of mutation.addedNodes) {
      if (node instanceof Element && node.hasAttribute('data-gloss-plus-one-edit-id')) {
        return true
      }
    }
    // characterData mutations inside our edit spans
    if (mutation.type === 'characterData' && mutation.target.parentElement) {
      if (mutation.target.parentElement.closest('[data-gloss-plus-one-edit-id]')) {
        return true
      }
    }
    return false
  }

  private resetCaches(): void {
    this.extractedElements = new WeakSet<Element>()
    this.extractedPaths = new Set<string>()
    this.accumulatedBlocks = []
    this.batchIndex = 0
    this.cumulativeChars = 0
    this.nextSequence = 0
  }
}

function parseRootMargin(rootMargin: string): {
  top: number
  right: number
  bottom: number
  left: number
} {
  const values = rootMargin
    .trim()
    .split(/\s+/)
    .map((value) => parseInt(value.replace('px', ''), 10))
    .filter((value) => Number.isFinite(value))

  if (values.length === 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  if (values.length === 1) {
    const [all] = values
    return { top: all, right: all, bottom: all, left: all }
  }

  if (values.length === 2) {
    const [vertical, horizontal] = values
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal }
  }

  if (values.length === 3) {
    const [top, horizontal, bottom] = values
    return { top, right: horizontal, bottom, left: horizontal }
  }

  const [top, right, bottom, left] = values
  return { top, right, bottom, left }
}
