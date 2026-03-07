import { describe, expect, it } from "vitest";
import { isReadableParagraph } from "@/content/reader/parser/filter";

const longProse =
  "The city council introduced a practical transit proposal that would improve reliability and reduce waiting time for riders across several neighborhoods while preserving affordable fares for students and seniors.";

describe("isReadableParagraph", () => {
  const cases: Array<{ name: string; text: string; expected: boolean }> = [
    { name: "rejects under 20 words", text: "This text is short and not enough words for extraction quality.", expected: false },
    { name: "accepts long prose", text: longProse, expected: true },
    { name: "rejects url", text: `${longProse} Read more at https://example.com/details.`, expected: false },
    { name: "rejects www url", text: `${longProse} Visit www.example.com now.`, expected: false },
    { name: "rejects bare domain path", text: `${longProse} example.org/path is linked.`, expected: false },
    {
      name: "rejects all caps",
      text: "THIS SENTENCE IS WRITTEN IN LOUD UPPERCASE WORDS TO LOOK LIKE AN ALERT BANNER AND SHOULD BE FILTERED OUT FOR READABILITY PURPOSES.",
      expected: false,
    },
    { name: "accepts acronym rich sentence", text: `${longProse} NASA and the EU released mixed-case policy summaries.`, expected: true },
    { name: "rejects heavy punctuation and numbers", text: "2026-03-07 | 44.2% | +99.2 | 5000/22 !!! $$$ ### 90394 88383 11211", expected: false },
    { name: "accepts prices in prose", text: `${longProse} The ticket costs $19.99 and parking is €12 for visitors.`, expected: true },
    { name: "rejects fenced code", text: "```js const value = items.map(x => x.id); return value; ``` extra words included to exceed minimum threshold safely", expected: false },
    { name: "rejects code keywords", text: "const render = () => { return list.filter(Boolean); }; this block resembles implementation details and not article prose context for readers", expected: false },
    { name: "rejects sql shape", text: "SELECT name FROM users WHERE id = 1 and this expression continues only to mimic database language patterns in plain text", expected: false },
    { name: "rejects byline metadata", text: "By Jane Doe Updated March 7 2026 and edited at noon with latest details for this piece and share links below", expected: false },
    { name: "rejects menu labels", text: "Home | News | Sports | Business | Contact | Subscribe | Login | Weather | TV | Radio", expected: false },
    { name: "accepts parenthetical prose", text: `${longProse} Residents (especially older adults) said service consistency matters most.`, expected: true },
    { name: "accepts one code token in prose", text: `${longProse} One organizer joked the word function appears in daily speech now.`, expected: true },
    { name: "rejects mixed url and all caps", text: "VISIT HTTPS://EXAMPLE.COM NOW FOR MORE DETAILS ABOUT THE ANNOUNCEMENT AND SHARE IT WITH YOUR FRIENDS TODAY", expected: false },
    { name: "accepts long social paragraph", text: "People in my neighborhood started a repair club where residents bring broken lamps and bikes, learn practical skills, share tools, and leave with working items while reducing waste and building trust.", expected: true },
    { name: "rejects symbols heavy with enough words", text: "++ -- == != 1000 2000 3000 >>> <<< ??? !!! ### $$$ %%% @@@ *** /// \\\\ ::: ;;", expected: false },
    { name: "accepts academic style sentence", text: "Researchers examined longitudinal outcomes across multiple cohorts and found that intervention timing, institutional context, and baseline socioeconomic variance jointly influenced measurable literacy gains over three years.", expected: true },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(isReadableParagraph(testCase.text)).toBe(testCase.expected);
    });
  }
});

