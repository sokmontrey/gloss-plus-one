import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Minus, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPORTED_TARGET_LANGUAGES, TARGET_LANGUAGE_LABELS } from "@/shared/languages";
import {
  DISABLED_PAGES_KEY,
  isPageDisabled,
  isToggleablePageUrl,
  setPageDisabled,
} from "@/shared/pageDisable";
import { BANK_KEY, createEmptyPhraseBank, getPhraseBankFromSnapshot } from "@/shared/phraseBankStorage";
import type { PhraseBank, ProgressionConfig, UserContext, UserInterestProfile } from "@/shared/types";

const CONFIG_KEY = "glossProgressionConfig";
const INTEREST_KEY = "glossInterestProfile";
const USER_CONTEXT_KEY = "userContext";
const PROGRESSION_STEPS = [0.4, 0.55, 0.7, 0.82, 0.92] as const;

const DEFAULT_CONFIG: ProgressionConfig = {
  progressionThreshold: 0.7,
  confidenceGainPerExposure: 0.03,
  confidenceDecayPerHover: 0.1,
  hoverDecayThresholdMs: 2000,
};

interface PopupState {
  bank: PhraseBank | null;
  config: ProgressionConfig;
  targetLanguage: UserContext["targetLanguage"];
  profile: UserInterestProfile | null;
}

interface PageControlState {
  status: "loading" | "ready" | "unsupported";
  url: string | null;
  disabled: boolean;
  saving: boolean;
}

function getStageProgress(bank: PhraseBank | null, threshold: number): {
  label: string;
  progress: number;
  averageConfidence: number;
  phraseCount: number;
} {
  if (!bank) {
    return {
      label: "No progression data yet",
      progress: 0,
      averageConfidence: 0,
      phraseCount: 0,
    };
  }

  const latestBatch = [...bank.batches]
    .reverse()
    .find((batch) => batch.triggerReason === "initial" || batch.triggerReason === "progression");

  if (!latestBatch) {
    return {
      label: "Waiting for first discovery batch",
      progress: 0,
      averageConfidence: 0,
      phraseCount: 0,
    };
  }

  const sample = bank.phrases
    .filter((phrase) => phrase.addedByBatch === latestBatch.id)
    .filter((phrase) => phrase.exposures > 0)
    .sort((left, right) => {
      const leftScore = left.lastSeenAt || left.addedAt;
      const rightScore = right.lastSeenAt || right.addedAt;
      return rightScore - leftScore;
    })
    .slice(0, 10);

  if (sample.length === 0) {
    return {
      label: "Read with the newest phrases to unlock the next stage",
      progress: 0,
      averageConfidence: 0,
      phraseCount: 0,
    };
  }

  const averageConfidence = sample.reduce((sum, phrase) => sum + phrase.confidence, 0) / sample.length;
  const progress = Math.max(0, Math.min(1, averageConfidence / Math.max(threshold, 0.01)));

  return {
    label: `${sample.length}/10 newest phrases tracked`,
    progress,
    averageConfidence,
    phraseCount: sample.length,
  };
}

function thresholdToSliderValue(threshold: number): number {
  const closestIndex = PROGRESSION_STEPS.reduce(
    (bestIndex, value, index) =>
      Math.abs(value - threshold) < Math.abs(PROGRESSION_STEPS[bestIndex] - threshold) ? index : bestIndex,
    0,
  );
  return closestIndex + 1;
}

function sliderValueToThreshold(value: number): number {
  return PROGRESSION_STEPS[Math.max(0, Math.min(PROGRESSION_STEPS.length - 1, value - 1))] ?? 0.7;
}

function openDashboard() {
  chrome.runtime.openOptionsPage?.() ?? chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") });
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function reloadActiveTab(): Promise<void> {
  const tab = await getActiveTab();
  if (typeof tab?.id !== "number") {
    return;
  }

  await chrome.tabs.reload(tab.id);
}

async function triggerDiscoveryOnActiveTab(): Promise<void> {
  const tab = await getActiveTab();
  if (typeof tab?.id !== "number") {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "RUN_PAGE_DISCOVERY_NOW" });
  } catch (error) {
    console.warn("[GlossPlusOne:popup] Failed to trigger discovery on active tab", error);
  }
}

async function getCurrentPageStatus(): Promise<PageControlState> {
  const tab = await getActiveTab();
  const url = typeof tab?.url === "string" ? tab.url : null;
  if (!url) {
    return {
      status: "unsupported",
      url: null,
      disabled: false,
      saving: false,
    };
  }

  if (!isToggleablePageUrl(url)) {
    return {
      status: "unsupported",
      url,
      disabled: false,
      saving: false,
    };
  }

  return {
    status: "ready",
    url,
    disabled: await isPageDisabled(url),
    saving: false,
  };
}

export default function App() {
  const [state, setState] = useState<PopupState>({
    bank: createEmptyPhraseBank("es"),
    config: DEFAULT_CONFIG,
    targetLanguage: "es",
    profile: null,
  });
  const [isPlanning, setIsPlanning] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pageControl, setPageControl] = useState<PageControlState>({
    status: "loading",
    url: null,
    disabled: false,
    saving: false,
  });

  const sliderValue = useMemo(
    () => thresholdToSliderValue(state.config.progressionThreshold),
    [state.config.progressionThreshold],
  );
  const pageLabel = useMemo(() => {
    if (!pageControl.url) {
      return "";
    }

    try {
      const url = new URL(pageControl.url);
      return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
    } catch {
      return pageControl.url;
    }
  }, [pageControl.url]);
  const stageProgress = useMemo(
    () => getStageProgress(state.bank, state.config.progressionThreshold),
    [state.bank, state.config.progressionThreshold],
  );

  useEffect(() => {
    const refresh = async () => {
      const [result, nextPageControl] = await Promise.all([
        chrome.storage.local.get([BANK_KEY, CONFIG_KEY, INTEREST_KEY, USER_CONTEXT_KEY]),
        getCurrentPageStatus(),
      ]);
      const userContext = result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined;
      const targetLanguage = userContext?.targetLanguage ?? "es";
      setState({
        bank: getPhraseBankFromSnapshot(result[BANK_KEY], targetLanguage),
        config: {
          ...DEFAULT_CONFIG,
          ...(result[CONFIG_KEY] as Partial<ProgressionConfig> | undefined),
        },
        targetLanguage,
        profile: (result[INTEREST_KEY] as UserInterestProfile | undefined) ?? null,
      });
      setPageControl((current) => ({
        ...nextPageControl,
        saving: current.saving && current.url === nextPageControl.url ? current.saving : false,
      }));
    };

    void refresh();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (
        area === "local" &&
        (changes[BANK_KEY] ||
          changes[CONFIG_KEY] ||
          changes[INTEREST_KEY] ||
          changes[USER_CONTEXT_KEY] ||
          changes[DISABLED_PAGES_KEY])
      ) {
        void refresh();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handlePlanner = async (reason: "debug_increment" | "debug_decrement") => {
    if (reason === "debug_increment") {
      setIsPlanning(true);
      const language = state.targetLanguage;

      await chrome.runtime.sendMessage({
        type: "ENSURE_STRUCTURAL_TRANSLATIONS",
        payload: { language },
      });

      await chrome.runtime.sendMessage({
        type: "TRIGGER_PLANNER",
        payload: { reason: "debug_increment", language },
      });

      await triggerDiscoveryOnActiveTab();

      window.setTimeout(() => {
        setIsPlanning(false);
        void chrome.storage.local.get(BANK_KEY).then((result) => {
          setState((current) => ({
            ...current,
            bank: getPhraseBankFromSnapshot(result[BANK_KEY], current.targetLanguage),
          }));
        });
      }, 3500);
      return;
    }

    await chrome.runtime.sendMessage({
      type: "TRIGGER_PLANNER",
      payload: {
        reason,
        language: state.targetLanguage,
      },
    });
  };

  const handleThresholdChange = async (nextValue: number) => {
    const progressionThreshold = sliderValueToThreshold(nextValue);
    setState((current) => ({
      ...current,
      config: {
        ...current.config,
        progressionThreshold,
      },
    }));
    await chrome.runtime.sendMessage({
      type: "UPDATE_PROGRESSION_CONFIG",
      payload: { progressionThreshold },
    });
  };

  const handleLanguageChange = async (nextLanguage: UserContext["targetLanguage"]) => {
    setState((current) => ({
      ...current,
      targetLanguage: nextLanguage,
      bank: createEmptyPhraseBank(nextLanguage),
    }));

    const result = await chrome.storage.local.get([USER_CONTEXT_KEY, BANK_KEY]);
    const currentUserContext = (result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined) ?? {};
    setState((current) => ({
      ...current,
      bank: getPhraseBankFromSnapshot(result[BANK_KEY], nextLanguage),
    }));
    await chrome.storage.local.set({
      [USER_CONTEXT_KEY]: {
        ...currentUserContext,
        targetLanguage: nextLanguage,
      },
    });

    chrome.runtime.sendMessage({
      type: "ENSURE_STRUCTURAL_TRANSLATIONS",
      payload: { language: nextLanguage },
    });
  };

  const handlePageToggle = async () => {
    if (pageControl.status !== "ready" || !pageControl.url || pageControl.saving) {
      return;
    }

    const nextDisabled = !pageControl.disabled;
    setPageControl((current) => ({
      ...current,
      saving: true,
    }));

    const disabled = await setPageDisabled(pageControl.url, nextDisabled);
    setPageControl((current) => ({
      ...current,
      disabled,
      saving: false,
    }));

    // Disabling should restore the page to its untouched DOM immediately.
    if (disabled) {
      await reloadActiveTab();
    }
  };

  const handleResetLanguageConfirm = async () => {
    const language = state.targetLanguage;
    setShowResetConfirm(false);

    await chrome.runtime.sendMessage({
      type: "RESET_LANGUAGE_DATA",
      payload: { language },
    });

    setState((current) => ({
      ...current,
      bank: createEmptyPhraseBank(language),
    }));

    chrome.runtime.sendMessage({
      type: "ENSURE_STRUCTURAL_TRANSLATIONS",
      payload: { language },
    });
  };

  return (
    <main className="flex min-w-[320px] flex-col gap-4 bg-background p-4 text-foreground">
      <div className="space-y-1">
        <p className="text-sm font-medium">GlossPlusOne</p>
        <p className="text-xs text-muted-foreground">
          Tier {state.bank?.currentTier ?? 1} for {state.targetLanguage.toUpperCase()}.
          {" "}
          {state.bank?.phrases.length ?? 0} phrases ready.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium">Learning Language</p>
            <p className="text-[11px] text-muted-foreground">Switch banks and page replacements instantly</p>
          </div>
          <select
            value={state.targetLanguage}
            onChange={(event) => void handleLanguageChange(event.target.value as UserContext["targetLanguage"])}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            {SUPPORTED_TARGET_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {TARGET_LANGUAGE_LABELS[language]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">This Page</p>
            <p className="text-[11px] text-muted-foreground">
              {pageControl.status === "ready"
                ? pageControl.disabled
                  ? "Gloss replacements and learning controls are paused here"
                  : "Gloss replacements and learning controls are active here"
                : "This tab cannot be modified"}
            </p>
          </div>
          <Badge variant={pageControl.disabled ? "muted" : "success"}>
            {pageControl.status === "ready" ? (pageControl.disabled ? "Paused" : "Active") : "Unavailable"}
          </Badge>
        </div>
        {pageControl.status === "ready" ? (
          <>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">{pageLabel}</p>
            <Button
              size="sm"
              variant={pageControl.disabled ? "outline" : "secondary"}
              onClick={() => void handlePageToggle()}
              disabled={pageControl.saving}
              className="mt-3 w-full justify-center"
            >
              {pageControl.saving
                ? "Saving..."
                : pageControl.disabled
                  ? "Enable on this page"
                  : "Pause on this page"}
            </Button>
          </>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Chrome internal pages and extension pages cannot be changed.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Stage Progress</span>
          <Badge variant="warning">Tier {state.bank?.currentTier ?? 1}</Badge>
        </div>
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(stageProgress.progress * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{stageProgress.label}</span>
            <span>{Math.round(stageProgress.averageConfidence * 100)}%</span>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {state.bank?.phrases.length ?? 0} phrases · {state.bank?.batches.length ?? 0} batches
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handlePlanner("debug_decrement")}
            className="min-w-0 justify-center gap-1.5"
          >
            <Minus className="shrink-0" />
            <span className="truncate">Reset stage</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void handlePlanner("debug_increment")}
            disabled={isPlanning}
            className="min-w-0 justify-center gap-1.5"
          >
            <Plus className="shrink-0" />
            <span className="truncate">{isPlanning ? "Advancing..." : "Next stage"}</span>
          </Button>
        </div>
        {showResetConfirm ? (
          <div className="mt-2 flex min-w-0 flex-col gap-2 rounded-md border border-rose-200 bg-rose-50/50 p-2 dark:border-rose-800 dark:bg-rose-950/30">
            <p className="text-xs text-rose-800 dark:text-rose-200">
              Reset all phrase bank and progression for {state.targetLanguage.toUpperCase()}?
            </p>
            <div className="flex min-w-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
                className="min-w-0 flex-1 shrink"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleResetLanguageConfirm()}
                className="min-w-0 flex-1 shrink"
              >
                Reset
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowResetConfirm(true)}
            className="mt-2 w-full min-w-0 justify-center gap-2 text-rose-700"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Reset This Language</span>
          </Button>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          New discovery phrases raise this bar. High average confidence unlocks harder vocabulary.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">Progression Threshold</p>
            <p className="text-[11px] text-muted-foreground">How confident before introducing next phrases</p>
          </div>
          <Badge variant="outline">{Math.round(state.config.progressionThreshold * 100)}%</Badge>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={sliderValue}
          onChange={(event) => void handleThresholdChange(Number(event.target.value))}
          className="mt-3 h-2 w-full accent-primary"
        />
      </section>

      <section className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Reading profile</span>
          <span className="text-[11px] text-muted-foreground">
            {state.profile?.topTopics.length ?? 0} topic tags
          </span>
        </div>
        {state.profile && state.profile.topTopics.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {state.profile.topTopics.slice(0, 5).map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-slate-400">Topics will appear after reading a few pages</p>
        )}
      </section>

      <Button size="sm" variant="outline" onClick={openDashboard} className="w-full justify-center gap-2">
        <ExternalLink className="h-3.5 w-3.5" />
        Open dashboard
      </Button>
    </main>
  );
}
