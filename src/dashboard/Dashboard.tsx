import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LearnerPhraseState, PhraseMemory } from "@/shared/types";

const USER_CONTEXT_KEY = "userContext";
const PHRASE_STATE_KEY = "glossPhraseState";

interface StoredUserContext {
  progressionThreshold?: number;
  debugLearnerLevel?: number;
  targetLanguage?: "es" | "fr" | "de" | "pt" | "it";
  [key: string]: unknown;
}

const DEFAULT_PROGRESSION = 0.6;
const DEFAULT_DEBUG_LEVEL = 0;
const DEFAULT_LANG = "es";

function loadStoredContext(): Promise<StoredUserContext> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([USER_CONTEXT_KEY], (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve((result[USER_CONTEXT_KEY] as StoredUserContext) ?? {});
    });
  });
}

function loadPhraseState(): Promise<LearnerPhraseState> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([PHRASE_STATE_KEY], (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else
        resolve(
          (result[PHRASE_STATE_KEY] as LearnerPhraseState) ?? {
            seenPhrases: [],
            pendingIntroductions: [],
            totalSessionCount: 0,
            lastSessionAt: 0,
          },
        );
    });
  });
}

function saveStoredContext(partial: Partial<StoredUserContext>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([USER_CONTEXT_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const current = (result[USER_CONTEXT_KEY] as StoredUserContext) ?? {};
      chrome.storage.local.set({ [USER_CONTEXT_KEY]: { ...current, ...partial } }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  });
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Newest first (lastSeenAt desc), then by firstSeenAt desc */
function sortNewestFirst(phrases: PhraseMemory[]): PhraseMemory[] {
  return [...phrases].sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || (b.firstSeenAt || 0) - (a.firstSeenAt || 0));
}

function confidenceVariant(confidence: number): "success" | "warning" | "muted" {
  if (confidence >= 0.7) return "success";
  if (confidence >= 0.3) return "warning";
  return "muted";
}

export default function Dashboard() {
  const [progressionThreshold, setProgressionThreshold] = useState(DEFAULT_PROGRESSION);
  const [debugLearnerLevel, setDebugLearnerLevel] = useState(DEFAULT_DEBUG_LEVEL);
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_LANG);
  const [seenPhrases, setSeenPhrases] = useState<PhraseMemory[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [saved, setSaved] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const refresh = () => {
    Promise.all([loadStoredContext(), loadPhraseState()]).then(([ctx, state]) => {
      const lang = ctx.targetLanguage ?? DEFAULT_LANG;
      setTargetLanguage(lang);
      setSeenPhrases(sortNewestFirst(state.seenPhrases.filter((p) => p.targetLanguage === lang)));
      setTotalSessions(state.totalSessionCount ?? 0);
      if (typeof ctx.progressionThreshold === "number") setProgressionThreshold(clamp(ctx.progressionThreshold, 0, 1));
      if (typeof ctx.debugLearnerLevel === "number") setDebugLearnerLevel(clamp(ctx.debugLearnerLevel, 0, 1));
    });
  };

  useEffect(() => {
    refresh();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && (changes[USER_CONTEXT_KEY] || changes[PHRASE_STATE_KEY])) refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleSave = () => {
    saveStoredContext({ progressionThreshold, debugLearnerLevel }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const handleReset = () => {
    chrome.runtime.sendMessage({ type: "RESET_PHRASES" }).then(() => {
      setResetDone(true);
      setSeenPhrases([]);
      setTotalSessions(0);
      setTimeout(() => setResetDone(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">GlossPlusOne</h1>
        <p className="text-sm text-muted-foreground">
          {seenPhrases.length} phrase{seenPhrases.length !== 1 ? "s" : ""} · {targetLanguage.toUpperCase()}
          {totalSessions > 0 && ` · ${totalSessions} session${totalSessions !== 1 ? "s" : ""}`}
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6">
        {/* Settings strip — single row */}
        <section className="mb-8 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">
                Progression {(progressionThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={progressionThreshold}
                onChange={(e) => setProgressionThreshold(Number(e.target.value))}
                className="mt-1 h-2 w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Debug level {debugLearnerLevel === 0 ? "Nothing" : debugLearnerLevel === 1 ? "Everything" : `${(debugLearnerLevel * 100).toFixed(0)}%`}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={debugLearnerLevel}
                onChange={(e) => setDebugLearnerLevel(Number(e.target.value))}
                className="mt-1 h-2 w-full accent-primary"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSave}>
              {saved ? "Saved" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="text-destructive hover:bg-destructive/10">
              {resetDone ? "Reset complete" : "Reset learned phrases"}
            </Button>
          </div>
        </section>

        {/* Seen words — flat list, newest first */}
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-medium text-foreground">Seen words</h2>
          {seenPhrases.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
              No learned phrases yet. Browse with the extension on to build your list.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div
                className="grid min-w-lg grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto_auto_5rem] items-center gap-x-3 px-4 pb-1.5 text-xs font-medium text-muted-foreground"
                aria-hidden
              >
                <span>Phrase</span>
                <span />
                <span>Translation</span>
                <span className="w-9 text-center">Conf.</span>
                <span>Type</span>
                <span>Stats</span>
                <span className="w-20" />
              </div>
              <ul className="space-y-2">
              {seenPhrases.map((p, i) => (
                <li
                  key={`${p.phrase}-${p.targetLanguage}-${i}`}
                  className="grid min-w-lg grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto_auto_5rem] items-center gap-x-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium" title={p.phrase}>
                    {p.phrase}
                  </span>
                  <span className="shrink-0 text-muted-foreground" aria-hidden>→</span>
                  <span className="min-w-0 truncate text-muted-foreground" title={p.targetPhrase}>
                    {p.targetPhrase}
                  </span>
                  <Badge variant={confidenceVariant(p.confidence)} className="shrink-0 w-9 justify-center">
                    {(p.confidence * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline" className="shrink-0">
                    {p.phraseType}
                  </Badge>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {p.exposures} exp · {p.reveals} rev
                  </span>
                  <div
                    className="h-1.5 w-20 min-w-20 shrink-0 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={p.confidence * 100}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${p.confidence * 100}%` }}
                    />
                  </div>
                </li>
              ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
