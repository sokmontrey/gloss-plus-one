import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { TranslationClass } from "./translation.ts";
import type { Lexicon } from "../lexicon/index.ts";

Deno.test("TranslationClass.translateLexicons - success", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      assertEquals(url, "http://localhost:8003/translate");
      assertEquals(init?.method, "POST");

      const body = JSON.parse(init?.body as string);
      assertEquals(body.text, "the dog");
      assertEquals(body.target_lang, "fr");
      assertEquals(body.lexicons, [
        { id: 1, start: 0, end: 3, text: "the" },
      ]);

      const mockResponse = {
        translations: [
          { id: 1, source: "the", target: "le" },
        ],
      };

      return Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    };

    const lexicons: Lexicon[] = [
      { id: 1, start: 0, end: 3, text: "the", type: "function" },
    ];

    const translationService = new TranslationClass();
    const result = await translationService.translateLexicons("the dog", lexicons, "fr");
    
    assertEquals(result.length, 1);
    assertEquals(result[0], { id: 1, source: "the", target: "le" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("TranslationClass.translateLexicons - handles service failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      return Promise.resolve(new Response("Gateway Timeout", {
        status: 504,
      }));
    };

    const translationService = new TranslationClass();
    assertRejects(
      () => translationService.translateLexicons("the dog", [], "fr"),
      Error,
      "translation-service 504: Gateway Timeout",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
