export interface TextBlock {
  text: string
  tagName: string
  path: string
}

export interface ExtractionResult {
  url: string
  title: string
  extractedAt: string
  blocks: TextBlock[]
  stats: {
    totalBlocks: number
    totalChars: number
  }
}

export interface ExtractionBatch {
  batchIndex: number
  trigger: 'viewport' | 'scroll' | 'mutation' | 'resize' | 'manual'
  blocks: TextBlock[]
  stats: {
    batchBlocks: number
    batchChars: number
    cumulativeBlocks: number
    cumulativeChars: number
  }
}

export interface LazyExtractionConfig {
  rootMargin: string
  minBlockChars: number
  mutationDebounceMs: number
}
