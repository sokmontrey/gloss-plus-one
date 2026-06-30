import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { LexiconClass } from "./lexicon.ts";

Deno.test("LexiconClass.getReplaceableLexicons - success", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      assertEquals(url, "http://localhost:8001/split");
      assertEquals(init?.method, "POST");

      const body = JSON.parse(init?.body as string);
      assertEquals(body, { text: "hello world" });

      const mockResponse = {
        lexicons: [
          { id: 1, start: 0, end: 5, text: "hello", type: "content" },
          { id: 2, start: 6, end: 11, text: "world", type: "function" },
        ],
      };

      return Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    };

    const lexiconService = new LexiconClass();
    const result = await lexiconService.getReplaceableLexicons("hello world");
    
    // Only the "function" type lexicon should be returned
    assertEquals(result.length, 1);
    assertEquals(result[0], { id: 2, start: 6, end: 11, text: "world", type: "function" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("LexiconClass.getReplaceableLexicons - handles service failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      return Promise.resolve(new Response("Service Unavailable", {
        status: 503,
      }));
    };

    const lexiconService = new LexiconClass();
    assertRejects(
      () => lexiconService.getReplaceableLexicons("hello world"),
      Error,
      "lexicon-service 503: Service Unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
