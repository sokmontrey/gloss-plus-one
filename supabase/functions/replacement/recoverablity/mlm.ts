import type { RecoverablityService } from "./index.ts";

export class MlmRecoverabilityService implements RecoverablityService {
  private readonly MLM_URL = Deno.env.get("MLM_URL") ?? "http://localhost:8002";
  async score(text: string): Promise<number[]> {
    const response = await fetch(`${this.MLM_URL}/recoverable_score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return [];
    }
    const data = await response.json(); // idk if we need to await again but I will leave for now
    return data.score;
  }
}
