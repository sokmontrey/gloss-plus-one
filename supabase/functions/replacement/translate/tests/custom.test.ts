import { assertEquals } from "jsr:@std/assert";
import { CustomTranslationService } from "../custom.ts";

Deno.test("calling translate method on the custom translation service", async () => {
    const apiUrl = Deno.env.get("SB_TRANSLATE_CUSTOM_TEST_API_URL")!;
    const service = new CustomTranslationService(apiUrl);

    const result = await service.translate(["Hello"], "en", "pt");
    assertEquals(result[0], "Olá.");
});
