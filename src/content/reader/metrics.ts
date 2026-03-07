type Phase = "initial" | "delta";

interface MetricRun {
  phase: Phase;
  startedAt: number;
}

export function createMetrics(debug: boolean) {
  const counters = {
    initialRuns: 0,
    deltaRuns: 0,
    initialMs: 0,
    deltaMs: 0,
  };

  return {
    start(phase: Phase): MetricRun {
      return { phase, startedAt: performance.now() };
    },
    end(run: MetricRun) {
      const duration = performance.now() - run.startedAt;
      if (run.phase === "initial") {
        counters.initialRuns += 1;
        counters.initialMs += duration;
        if (debug && duration > 100) console.warn("[GlossPlusOne] Slow initial extraction", duration);
      } else {
        counters.deltaRuns += 1;
        counters.deltaMs += duration;
        if (debug && duration > 32) console.warn("[GlossPlusOne] Slow delta extraction", duration);
      }
    },
    summary() {
      if (!debug) return;
      console.debug("[GlossPlusOne] Extraction metrics", counters);
    },
  };
}

