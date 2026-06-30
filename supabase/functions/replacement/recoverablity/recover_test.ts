import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { RecoverClass } from "./recover.ts";
import type { Lexicon } from "../lexicon/index.ts";

Deno.test("RecoverClass.recoverableScore - success", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      assertEquals(url, "http://localhost:8002/recoverable");
      assertEquals(init?.method, "POST");
      assertEquals(init?.headers, {
        "Content-Type": "application/json",
      });
      
      const body = JSON.parse(init?.body as string);
      assertEquals(body, { text: "hello world", start: 0, end: 5 });

      return Promise.resolve(new Response(JSON.stringify({ score: 0.85 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    };

    const recover = new RecoverClass();
    const score = await recover.recoverableScore("hello world", 0, 5);
    assertEquals(score, 0.85);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("RecoverClass.recoverableScore - handles non-ok response", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      return Promise.resolve(new Response("Internal Server Error", {
        status: 500,
      }));
    };

    const recover = new RecoverClass();
    const score = await recover.recoverableScore("hello world", 0, 5);
    assertEquals(score, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("RecoverClass.scoreLexicons - success and overlap logic", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      assertEquals(url, "http://localhost:8002/recoverable_score");
      assertEquals(init?.method, "POST");

      const body = JSON.parse(init?.body as string);
      assertEquals(body.text, "the dog jumps");
      assertEquals(body.include_ranges, [
        { start: 0, end: 3 },
        { start: 8, end: 13 },
      ]);

      const mockResponse = {
        tokens: [
          // Overlaps with "the" (0-3)
          // Using exact binary representation floats to avoid precision drift
          { text: "th", start: 0, end: 2, score: 0.75 },
          { text: "he", start: 1, end: 3, score: 0.25 },
          // Overlaps with "jumps" (8-13)
          { text: "jumps", start: 8, end: 13, score: 0.5 },
        ],
      };

      return Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    };

    const lexicons: Lexicon[] = [
      { id: 1, start: 0, end: 3, text: "the", type: "function" },
      { id: 2, start: 8, end: 13, text: "jumps", type: "function" },
    ];

    const recover = new RecoverClass();
    const result = await recover.scoreLexicons("the dog jumps", lexicons);

    assertEquals(result.length, 2);
    // "the" score should be average of 0.75 and 0.25 = 0.5
    assertEquals(result[0].score, 0.5);
    // "jumps" score should be 0.5
    assertEquals(result[1].score, 0.5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("RecoverClass.scoreLexicons - handles service failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      return Promise.resolve(new Response("Bad Request", {
        status: 400,
      }));
    };

    const lexicons: Lexicon[] = [
      { id: 1, start: 0, end: 3, text: "the", type: "function" },
    ];

    const recover = new RecoverClass();
    assertRejects(
      () => recover.scoreLexicons("the dog", lexicons),
      Error,
      "mlm-service 400: Bad Request",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
