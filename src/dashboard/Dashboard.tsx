import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPORTED_TARGET_LANGUAGES, TARGET_LANGUAGE_LABELS } from "@/shared/languages";
import { BANK_KEY, getPhraseBankFromSnapshot } from "@/shared/phraseBankStorage";
import type { BankPhrase, PhraseBank, ProgressionConfig, UserContext } from "@/shared/types";

const CONFIG_KEY = "glossProgressionConfig";
const USER_CONTEXT_KEY = "userContext";
const PROGRESSION_STEPS = [0.4, 0.55, 0.7, 0.82, 0.92] as const;

const DEFAULT_CONFIG: ProgressionConfig = {
  progressionThreshold: 0.7,
  confidenceGainPerExposure: 0.03,
  confidenceDecayPerHover: 0.1,
  hoverDecayThresholdMs: 2000,
};

interface DashboardState {
  bank: PhraseBank | null;
  config: ProgressionConfig;
  targetLanguage: UserContext["targetLanguage"];
  assessmentScore: number;
  assessmentHistory: UserContext["assessmentHistory"];
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

function confidenceVariant(confidence: number): "success" | "warning" | "muted" {
  if (confidence >= 0.7) return "success";
  if (confidence >= 0.3) return "warning";
  return "muted";
}

function sortBankPhrases(phrases: BankPhrase[]): BankPhrase[] {
  return [...phrases].sort((left, right) => right.addedAt - left.addedAt || right.lastSeenAt - left.lastSeenAt);
}

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    bank: null,
    config: DEFAULT_CONFIG,
    targetLanguage: "es",
    assessmentScore: 0,
    assessmentHistory: [],
  });
  const [plannerQueued, setPlannerQueued] = useState(false);

  const sliderValue = useMemo(
    () => thresholdToSliderValue(state.config.progressionThreshold),
    [state.config.progressionThreshold],
  );
  const phrases = useMemo(() => sortBankPhrases(state.bank?.phrases ?? []), [state.bank]);

  useEffect(() => {
    const refresh = async () => {
      const result = await chrome.storage.local.get([BANK_KEY, CONFIG_KEY, USER_CONTEXT_KEY]);
      const userContext = result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined;
      const targetLanguage = userContext?.targetLanguage ?? "es";
      setState({
        bank: getPhraseBankFromSnapshot(result[BANK_KEY], targetLanguage),
        config: {
          ...DEFAULT_CONFIG,
          ...(result[CONFIG_KEY] as Partial<ProgressionConfig> | undefined),
        },
        targetLanguage,
        assessmentScore: userContext?.assessmentScore ?? 0,
        assessmentHistory: userContext?.assessmentHistory ?? [],
      });
      setPlannerQueued(false);
    };

    void refresh();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && (changes[BANK_KEY] || changes[CONFIG_KEY] || changes[USER_CONTEXT_KEY])) {
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

  const handleLanguageChange = async (nextLanguage: UserContext["targetLanguage"]) => {
    const result = await chrome.storage.local.get([USER_CONTEXT_KEY]);
    const currentUserContext = (result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined) ?? {};
    await chrome.storage.local.set({
      [USER_CONTEXT_KEY]: {
        ...currentUserContext,
        targetLanguage: nextLanguage,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">GlossPlusOne</h1>
          <p className="text-sm text-muted-foreground">
            {phrases.length} phrase{phrases.length !== 1 ? "s" : ""} · {state.targetLanguage.toUpperCase()} · Tier{" "}
            {state.bank?.currentTier ?? 1}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1 text-sm shadow-sm">
            Assessment Score: <span className="ml-1.5 font-bold text-primary">{state.assessmentScore}</span>
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium">Learning Language</h2>
                <p className="text-xs text-muted-foreground">Swap phrase banks and live page replacements</p>
              </div>
              <select
                value={state.targetLanguage}
                onChange={(event) => void handleLanguageChange(event.target.value as UserContext["targetLanguage"])}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                {SUPPORTED_TARGET_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {TARGET_LANGUAGE_LABELS[language]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Phrase Bank Level</h2>
                <p className="text-xs text-muted-foreground">
                  + adds the next tier, - removes the latest batch
                </p>
              </div>
              <Badge variant="warning">Tier {state.bank?.currentTier ?? 1}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button size="icon" variant="outline" onClick={() => void handlePlanner("debug_decrement")}>
                <Minus />
              </Button>
              <div className="flex-1 text-center text-sm text-muted-foreground">
                {phrases.length} phrases · {state.bank?.batches.length ?? 0} batches
                {plannerQueued ? " · queued" : ""}
              </div>
              <Button size="icon" onClick={() => void handlePlanner("debug_increment")}>
                <Plus />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Progression Threshold</h2>
                <p className="text-xs text-muted-foreground">
                  How confident before introducing next phrases
                </p>
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
              className="mt-4 h-2 w-full accent-primary"
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Phrase Bank</h2>
            <span className="text-xs text-muted-foreground">
              Latest batch: {state.bank?.lastBatchId ? state.bank.lastBatchId.slice(0, 8) : "none"}
            </span>
          </div>
          {phrases.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
              No phrases yet. Use the + button to trigger the planner and seed the bank.
            </p>
          ) : (
            <div className="space-y-2">
              {phrases.map((phrase) => (
                <div
                  key={phrase.id}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium" title={phrase.phrase}>
                      {phrase.phrase}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tier {phrase.tier} · {phrase.targetLanguage.toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0 truncate text-muted-foreground" title={phrase.targetPhrase}>
                    {phrase.targetPhrase}
                  </div>
                  <Badge variant={confidenceVariant(phrase.confidence)} className="w-12 justify-center">
                    {Math.round(phrase.confidence * 100)}%
                  </Badge>
                  <Badge variant="outline">{phrase.phraseType}</Badge>
                  <div className="text-right text-xs text-muted-foreground">
                    {phrase.exposures} exp · {phrase.hoverCount} hover
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {state.assessmentHistory && state.assessmentHistory.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium">Assessment History</h2>
            <div className="space-y-2">
              {state.assessmentHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">"{entry.phrase}"</div>
                    <Badge variant={entry.score >= 4 ? "success" : entry.score >= 2 ? "warning" : "muted"}>
                      {entry.score}/5
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="opacity-70">Translation attempt:</span> "{entry.userTranslation}"
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/50">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
