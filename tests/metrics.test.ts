import { describe, expect, it, vi } from "vitest";
import { createMetrics } from "@/content/reader/metrics";

describe("metrics", () => {
  it("stays silent when debug is false", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const metrics = createMetrics(false);
    const run = metrics.start("initial");
    metrics.end(run);
    metrics.summary();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });
});

