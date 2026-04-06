// Stage 1: Expression Detection
// MVP: passthrough — returns text unchanged.
// Future: detect multi-word expressions (idioms, phrasal verbs) and lock their
// spans so they bypass the word-level pipeline.

export class NoOpExpressionDetector {
  detect(text: string): string {
    return text
  }
}
