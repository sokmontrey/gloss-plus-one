import { assertEquals } from "jsr:@std/assert@1";
import { ReplacementClass } from "./replacement.ts";
import type { ScoredLexicon } from "../recoverablity/index.ts";
import type { TranslationItem } from "../translation/index.ts";

Deno.test("ReplacementClass.buildReplacements - filters and maps correctly", () => {
  const scoredLexicons: ScoredLexicon[] = [
    // Meets default 0.85 threshold
    { id: 1, start: 0, end: 3, text: "the", type: "function", score: 0.9 },
    // Below threshold (should be skipped)
    { id: 2, start: 4, end: 7, text: "dog", type: "function", score: 0.8 },
    // No score (should be skipped)
    { id: 3, start: 8, end: 13, text: "jumps", type: "function", score: null },
    // Meets default 0.85 threshold but missing translation (should be skipped)
    { id: 4, start: 14, end: 18, text: "over", type: "function", score: 0.95 },
  ];

  const translations: TranslationItem[] = [
    { id: 1, source: "the", target: "le" },
    { id: 2, source: "dog", target: "chien" },
    { id: 3, source: "jumps", target: "saute" },
    // missing translation for id 4
  ];

  const service = new ReplacementClass();
  const result = service.buildReplacements(scoredLexicons, translations);

  assertEquals(result.length, 1);
  assertEquals(result[0], {
    start: 0,
    end: 3,
    original: "the",
    replacement: "le",
    score: 0.9,
  });
});

Deno.test("ReplacementClass.buildReplacements - supports custom threshold", () => {
  const scoredLexicons: ScoredLexicon[] = [
    { id: 1, start: 0, end: 3, text: "the", type: "function", score: 0.8 },
  ];

  const translations: TranslationItem[] = [
    { id: 1, source: "the", target: "le" },
  ];

  // Using a custom lower threshold of 0.75
  const service = new ReplacementClass(0.75);
  const result = service.buildReplacements(scoredLexicons, translations);

  assertEquals(result.length, 1);
  assertEquals(result[0].original, "the");
});
