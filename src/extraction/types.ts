export interface TextBlock {
  blockId: string
  sequence: number
  textHash: string
  text: string
  tagName: string
  path: string
}

export interface InlineEdit {
  id: string
  start: number
  end: number
  original: string
  replacement: string
  highlight?: {
    level?: 'low' | 'medium' | 'high'
    color?: string
    borderStyle?: string
  }
  data?: Record<string, unknown>
}

export interface PipelineResponse {
  schemaVersion: 1
  requestId: string
  blocks: Array<{
    blockId: string
    edits: InlineEdit[]
  }>
  data?: Record<string, unknown>
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
  maxBlocksPerBatch: number
}
