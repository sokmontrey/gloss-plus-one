import { assertEquals } from "jsr:@std/assert";
import { DeepLTranslationService } from "../deepl.ts";

Deno.test("calling translate method on the deepl translation service", async () => {
    const apiUrl = Deno.env.get("SB_TRANSLATE_DEEPL_TEST_API_URL")!;
    const apiKey = Deno.env.get("SB_TRANSLATE_DEEPL_TEST_API_KEY")!;
    const service = new DeepLTranslationService(apiUrl, apiKey);

    const result = await service.translate(["Hello"], "en", "pt");
    assertEquals(result[0], "Olá");
});
