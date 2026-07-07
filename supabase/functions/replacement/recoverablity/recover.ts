import type { Lexicon } from "../lexicon/index.ts";
import type { RecoverablityService } from "./index.ts";

export class MlmRecoverabilityService implements RecoverablityService {
  private readonly MLM_URL = Deno.env.get("MLM_URL") ?? "http://localhost:8002";
  async recoverableScore(
    text: string,
    start: number,
    end: number,
  ): Promise<number | null> {
    const response = await fetch(`${this.MLM_URL}/recoverable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, start, end }),
    });

    if (!response.ok) {
      return null;
    }
    const data = await response.json(); // idk if we need to await again but I will leave for now
    return data.score;
  }
}
