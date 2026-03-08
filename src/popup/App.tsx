import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DISABLED_PAGES_KEY,
  isPageDisabled,
  isToggleablePageUrl,
  setPageDisabled,
} from "@/shared/pageDisable";
import type { PhraseBank, ProgressionConfig, UserContext, UserInterestProfile } from "@/shared/types";

const BANK_KEY = "glossPhraseBank";
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
  targetLanguage: string;
  profile: UserInterestProfile | null;
}

interface PageControlState {
  status: "loading" | "ready" | "unsupported";
  url: string | null;
  disabled: boolean;
  saving: boolean;
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
    bank: null,
    config: DEFAULT_CONFIG,
    targetLanguage: "es",
    profile: null,
  });
  const [plannerQueued, setPlannerQueued] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
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

  useEffect(() => {
    const refresh = async () => {
      const [result, nextPageControl] = await Promise.all([
        chrome.storage.local.get([BANK_KEY, CONFIG_KEY, INTEREST_KEY, USER_CONTEXT_KEY]),
        getCurrentPageStatus(),
      ]);
      const userContext = result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined;
      setState({
        bank: (result[BANK_KEY] as PhraseBank | undefined) ?? null,
        config: {
          ...DEFAULT_CONFIG,
          ...(result[CONFIG_KEY] as Partial<ProgressionConfig> | undefined),
        },
        targetLanguage: userContext?.targetLanguage ?? "es",
        profile: (result[INTEREST_KEY] as UserInterestProfile | undefined) ?? null,
      });
      setPageControl((current) => ({
        ...nextPageControl,
        saving: current.saving && current.url === nextPageControl.url ? current.saving : false,
      }));
      setPlannerQueued(false);
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
    setPlannerQueued(true);
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
          <span className="text-xs text-muted-foreground">Phrase Bank Level</span>
          <Badge variant="warning">Tier {state.bank?.currentTier ?? 1}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button size="icon-sm" variant="outline" onClick={() => void handlePlanner("debug_decrement")}>
            <Minus />
          </Button>
          <div className="flex-1 text-center text-xs text-muted-foreground">
            {state.bank?.phrases.length ?? 0} phrases · {state.bank?.batches.length ?? 0} batches
            {plannerQueued ? " · queued" : ""}
          </div>
          <Button size="icon-sm" onClick={() => void handlePlanner("debug_increment")}>
            <Plus />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">`+` adds the next tier. `-` removes the last batch.</p>
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

      {state.profile && state.profile.topTopics.length > 0 ? (
        <section className="rounded-lg border border-border bg-muted/30 p-3">
          <button
            type="button"
            onClick={() => setProfileExpanded((current) => !current)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-xs font-medium">Reading profile</span>
            <span className="text-[11px] text-muted-foreground">
              {profileExpanded ? "Hide" : "Show"}
            </span>
          </button>
          {profileExpanded ? (
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
          ) : null}
        </section>
      ) : null}

      <Button size="sm" variant="outline" onClick={openDashboard} className="w-full justify-center gap-2">
        <ExternalLink className="h-3.5 w-3.5" />
        Open dashboard
      </Button>
    </main>
  );
}
