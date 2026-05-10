# Frontend Extraction Replacement MVP

Goal: make frontend reliable enough to prove full loop before real backend: Google-authenticated user enables site, content script lazily extracts page text, service worker runs placeholder pipeline, content script swaps inline text from `I` to `Yo`, and replacement format stays freeform for future pipeline metadata.

## Reliability First

Frontend must fail closed and keep page usable. Every replacement validates current DOM text before mutation, skips stale edits, avoids extension UI, handles repeated blocks independently, and logs enough detail to debug without leaking auth secrets.

## 1. Add Stable Block Identity Now

Files: `src/extraction/types.ts`, `src/extraction/text-walker.ts`, `src/extraction/lazy-extractor.ts`

Add `blockId`, `sequence`, and `textHash` to each extracted block.

```ts
export interface TextBlock {
  blockId: string
  sequence: number
  textHash: string
  text: string
  tagName: string
  path: string
}
```

`path` stays as DOM locator. `blockId` becomes contract anchor. Reason: backend and content script need stable per-block IDs so repeated identical text is not collapsed and replacement responses do not depend only on brittle DOM paths. For MVP, derive `blockId` from page URL, sequence, path, and text hash.

## 2. Add Freeform Inline Edit Contract

File: `src/extraction/types.ts`

```ts
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
```

`data` stays freeform for gloss, translation, lemma, confidence, model details, or progression info. `highlight.level` lets backend adjust visual intensity per replacement without changing frontend contract.

## 3. Add Placeholder Backend In Service Worker

File: `src/background.ts`

Replace log-only placeholder with local fake pipeline. Background handles Option A: both `ExtractionBatch` and `ExtractionResult` go through same fake pipeline.

Behavior:

- Receive extracted blocks from lazy batches or manual extraction.
- Find exact word-boundary `I` in each block.
- Return `PipelineResponse` edits that replace `I` with `Yo`.
- Send response back to source tab using `gloss-plus-one:pipeline-response`.
- Keep logs concise: request ID, block count, edit count, no auth token logs.

Flow:

```txt
content -> background: extraction batch/result
background -> fake pipeline: I -> Yo edits
background -> content: pipeline response
content -> DOM: inline swap
```

## 4. Add Content Pipeline Listener

File: `src/content.tsx`

Add listener for `gloss-plus-one:pipeline-response`, separate from manual extract listener. It calls `applyPipelineResponse(response)` and returns sync `false`.

This keeps manual extract response focused on extraction status while pipeline response arrives as its own message.

## 5. Apply Inline Text Swaps

File: `src/content.tsx`

For each response block:

1. Find extracted block by `blockId` in local registry.
2. Resolve current DOM element from stored `path`.
3. Re-extract current block text.
4. Validate each edit with `currentText.slice(start, end) === original`.
5. Reject overlapping edits.
6. Apply valid edits from end to start.
7. Wrap replacement with metadata span.

```html
<span data-gloss-plus-one-edit-id="..." data-gloss-plus-one-original="I">Yo</span>
```

Style only bottom border, yellow by default:

```ts
borderBottom: '2px solid #facc15'
```

Highlight level mapping:

- `low`: `1px solid #fde68a`
- `medium`: `2px solid #facc15`
- `high`: `3px solid #eab308`

Backend can override with `highlight.color` or `highlight.borderStyle` later.

## 6. Keep Block Registry

File: `src/content.tsx`

Maintain `Map<string, TextBlock>` for extracted blocks. Update it whenever lazy or manual extraction creates blocks. Pipeline responses use `blockId` to find current locator and original metadata.

This is more reliable than resolving by path alone and prepares for real backend responses.

## 7. Implement Path Resolver

File: `src/content.tsx`

Path still needed to find DOM element. Implement inverse of existing path format like `BODY[0]/DIV[2]/P[0]`.

Resolver rules:

- Start at `document.body`.
- If first segment matches root, consume it.
- For each next segment, parse `TAG[index]`.
- Pick nth child with same tag.
- Return `null` if any segment fails.

If resolver fails, skip block and log stale locator.

## 8. Replace Text Node Range

File: `src/content.tsx`

Implement `replaceTextRange(element, start, end, replacementNode)`.

MVP supports single text-node edits. If an edit spans multiple text nodes, skip and log. This is acceptable for `I -> Yo`, but real backend should eventually support multi-node ranges or only return ranges within normalized node boundaries.

## 9. Avoid Extension UI And Repeat Bugs

Files: `src/extraction/text-walker.ts`, `src/extraction/lazy-extractor.ts`

- Skip `[data-gloss-plus-one]` in extraction walker.
- Stop de-duping by `textHash` alone. Repeated identical text must remain distinct blocks.
- De-dupe by `blockId`/path for same DOM block only.
- Include `characterData: true` in mutation observer so SPA text updates can be extracted again.

## 10. Manual Extract Path

File: `src/content.tsx`, `src/background.ts`

Manual extraction sends `ExtractionResult`; background fake pipeline handles it directly. No conversion inside popup. Popup still reports extraction count; replacement happens through async pipeline response.

## 11. Automatic Extract Path

Lazy extraction sends batches only for enabled sites. After fake pipeline:

```txt
enabled site -> visible block batch -> background fake pipeline -> content replacement
```

No extra user action after enabling site and page reload/scroll.

## 12. Placeholder Limits Clarified

Placeholder means fake backend behavior for proving frontend plumbing only, not final product behavior.

Accepted temporary limits:

- It only replaces exact standalone `I` with `Yo`.
- It only mutates ranges contained in one text node.
- It skips stale offsets instead of trying fuzzy matching.
- It does not call remote backend.
- It does not persist learning/progression data.
- It does not implement hover/details UI yet.

Not temporary: `blockId`, freeform response shape, validation-before-mutation, bottom-border highlight, and separate pipeline response message should remain into real backend work.

## 13. Verification

Run:

```bash
npm run build
```

Manual browser test:

1. Reload extension so permissions and content scripts update.
2. Sign in with Google.
3. Open a normal HTTP/HTTPS page containing `I am testing.`
4. Enable extraction for site.
5. Click manual extract or reload/scroll.
6. Expected page text: `Yo am testing.`
7. Replacement has yellow bottom border only.
8. Console shows fake pipeline request/response with edit count.
9. Repeated `I` occurrences in separate blocks each get their own edit.

## 14. Later Real Backend Work

- Replace fake pipeline with `fetch` to backend endpoint.
- Send Supabase access token from service worker, never log it.
- Add response schema validation.
- Add revert/reapply strategy for SPA navigation and stale DOM.
- Add tests for duplicate text, offset validation, overlapping edits, and text updates.
