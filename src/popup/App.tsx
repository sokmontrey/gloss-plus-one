import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const USER_CONTEXT_KEY = "userContext";

interface StoredUserContext {
  progressionThreshold?: number;
  debugLearnerLevel?: number;
  [key: string]: unknown;
}

const DEFAULT_PROGRESSION = 0.6;
const DEFAULT_DEBUG_LEVEL = 0;

function loadStoredContext(): Promise<StoredUserContext> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([USER_CONTEXT_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const raw = result[USER_CONTEXT_KEY] as StoredUserContext | undefined;
      resolve(raw ?? {});
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
      const next = { ...current, ...partial };
      chrome.storage.local.set({ [USER_CONTEXT_KEY]: next }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function App() {
  const [progressionThreshold, setProgressionThreshold] = useState(DEFAULT_PROGRESSION);
  const [debugLearnerLevel, setDebugLearnerLevel] = useState(DEFAULT_DEBUG_LEVEL);
  const [saved, setSaved] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    loadStoredContext()
      .then((stored) => {
        const prog = stored.progressionThreshold;
        const debug = stored.debugLearnerLevel;
        if (typeof prog === "number") setProgressionThreshold(clamp(prog, 0, 1));
        if (typeof debug === "number") setDebugLearnerLevel(clamp(debug, 0, 1));
      })
      .catch((err) => console.warn("[GlossPlusOne:popup] Load failed", err));
  }, []);

  const handleSave = () => {
    saveStoredContext({
      progressionThreshold,
      debugLearnerLevel,
    })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      })
      .catch((err) => console.warn("[GlossPlusOne:popup] Save failed", err));
  };

  const handleResetPhrases = () => {
    chrome.runtime
      .sendMessage({ type: "RESET_PHRASES" })
      .then(() => {
        setResetDone(true);
        setTimeout(() => setResetDone(false), 2000);
      })
      .catch((err) => console.warn("[GlossPlusOne:popup] Reset failed", err));
  };

  return (
    <main className="min-w-72 p-4 text-slate-800">
      <h1 className="text-lg font-semibold">GlossPlusOne</h1>
      <p className="mt-1 text-sm text-slate-600">Your language layer is active</p>

      <section className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Progression rate
          <span className="ml-2 font-normal text-slate-500">
            ({(progressionThreshold * 100).toFixed(0)}%)
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={progressionThreshold}
          onChange={(e) => setProgressionThreshold(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <p className="text-xs text-slate-500">
          When to start introducing the next phrase step. Lower = introduce new phrases sooner;
          higher = wait until confidence is higher.
        </p>
      </section>

      <section className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Learner level (debug)
          <span className="ml-2 font-normal text-slate-500">
            {debugLearnerLevel === 0
              ? "Nothing"
              : debugLearnerLevel === 1
                ? "Everything"
                : `${(debugLearnerLevel * 100).toFixed(0)}%`}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={debugLearnerLevel}
          onChange={(e) => setDebugLearnerLevel(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <p className="text-xs text-slate-500">
          Debug only. Nothing = real progress. Everything = basics treated as known, exploration
          mode (new words only).
        </p>
      </section>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} className="mt-1">
            {saved ? "Saved" : "Save"}
          </Button>
          {saved && (
            <span className="text-xs text-slate-500">Settings stored.</span>
          )}
        </div>
        <div className="border-t border-slate-200 pt-3">
          <Button
            variant="outline"
            onClick={handleResetPhrases}
            className="w-full text-amber-700 hover:bg-amber-50"
          >
            {resetDone ? "Reset complete" : "Reset learned phrases"}
          </Button>
          <p className="mt-1 text-xs text-slate-500">
            Clear all learned phrases and start fresh. Reload the page to see changes.
          </p>
        </div>
      </div>
    </main>
  );
}
