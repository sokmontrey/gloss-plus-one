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
