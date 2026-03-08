import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SUPPORTED_TARGET_LANGUAGES, TARGET_LANGUAGE_LABELS } from "@/shared/languages";
import { BANK_KEY, getPhraseBankFromSnapshot } from "@/shared/phraseBankStorage";
import type { BankPhrase, DisplayConfig, PhraseBank, ProgressionConfig, UserContext } from "@/shared/types";
import { DEFAULT_DISPLAY_CONFIG } from "@/shared/types";

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
  displayConfig: DisplayConfig;
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

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function confidenceVariant(confidence: number): "success" | "warning" | "muted" {
  if (confidence >= 0.7) return "success";
  if (confidence >= 0.3) return "warning";
  return "muted";
}

function sortBankPhrases(phrases: BankPhrase[]): BankPhrase[] {
  return [...phrases].sort((left, right) => right.addedAt - left.addedAt || right.lastSeenAt - left.lastSeenAt);
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

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    bank: null,
    config: DEFAULT_CONFIG,
    targetLanguage: "es",
    assessmentScore: 0,
    assessmentHistory: [],
    displayConfig: { ...DEFAULT_DISPLAY_CONFIG },
  });
  const [plannerQueued, setPlannerQueued] = useState(false);

  const sliderValue = useMemo(
    () => thresholdToSliderValue(state.config.progressionThreshold),
    [state.config.progressionThreshold],
  );
  const stageProgress = useMemo(
    () => getStageProgress(state.bank, state.config.progressionThreshold),
    [state.bank, state.config.progressionThreshold],
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
        displayConfig: userContext?.displayConfig ?? { ...DEFAULT_DISPLAY_CONFIG },
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

  const handleDisplayConfigChange = (patch: Partial<DisplayConfig>) => {
    const nextConfig = { ...state.displayConfig, ...patch };
    setState((current) => ({ ...current, displayConfig: nextConfig }));
  };

  const saveDisplayConfig = async () => {
    const result = await chrome.storage.local.get([USER_CONTEXT_KEY]);
    const currentUserContext = (result[USER_CONTEXT_KEY] as Partial<UserContext> | undefined) ?? {};
    await chrome.storage.local.set({
      [USER_CONTEXT_KEY]: {
        ...currentUserContext,
        displayConfig: state.displayConfig,
      },
    });
  };

  const resetDisplayConfig = () => {
    setState((current) => ({ ...current, displayConfig: { ...DEFAULT_DISPLAY_CONFIG } }));
  };

  const [isSaved, setIsSaved] = useState(false);
  const saveDisplayConfigWithFeedback = async () => {
    await saveDisplayConfig();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
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
        <div className="flex items-center gap-3 shadow-md">
          <Badge variant="default" className="px-5 py-2 text-sm font-bold shadow-sm ring-2 ring-primary/20">
            Assessment Score: <span className="ml-1.5 text-primary-foreground">{state.assessmentScore}</span>
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
              <Select
                value={state.targetLanguage}
                onValueChange={(value) => void handleLanguageChange(value as UserContext["targetLanguage"])}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TARGET_LANGUAGES.map((language) => (
                    <SelectItem key={language} value={language}>
                      {TARGET_LANGUAGE_LABELS[language]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Stage Progress</h2>
                <p className="text-xs text-muted-foreground">
                  Read with the newest phrases to unlock the next stage
                </p>
              </div>
              <Badge variant="warning">Tier {state.bank?.currentTier ?? 1}</Badge>
            </div>
            
            <div className="mt-4 flex flex-col gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(stageProgress.progress * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{stageProgress.label}</span>
                <span>{Math.round(stageProgress.averageConfidence * 100)}%</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button size="icon" variant="outline" onClick={() => void handlePlanner("debug_decrement")}>
                <Minus />
              </Button>
              <div className="flex-1 text-center text-xs text-muted-foreground">
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
            <Slider
              min={1}
              max={5}
              step={1}
              value={[sliderValue]}
              onValueChange={(values) => void handleThresholdChange(values[0])}
              className="mt-5"
            />
          </div>
        </section>

        {/* Display Settings */}
        <section className="mb-8 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Display Settings</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetDisplayConfig}>
                Reset
              </Button>
              <Button size="sm" onClick={() => void saveDisplayConfigWithFeedback()}>
                {isSaved ? "Saved!" : "Save Changes"}
              </Button>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">

            {/* Highlight Hue */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Highlight Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hslToHex(state.displayConfig.highlightHue, 96, 56)}
                    onChange={(e) => {
                      // Extract hue from hex color
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16) / 255;
                      const g = parseInt(hex.slice(3, 5), 16) / 255;
                      const b = parseInt(hex.slice(5, 7), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      let h = 0;
                      if (max !== min) {
                        const d = max - min;
                        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
                        else if (max === g) h = ((b - r) / d + 2) * 60;
                        else h = ((r - g) / d + 4) * 60;
                      }
                      void handleDisplayConfigChange({ highlightHue: Math.round(h) });
                    }}
                    className="h-7 w-7 cursor-pointer rounded-md border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                    title="Pick a color"
                  />
                  <div
                    className="h-5 w-10 rounded-md border border-border"
                    style={{ backgroundColor: `hsl(${state.displayConfig.highlightHue}, 96%, 56%)` }}
                  />
                </div>
              </div>
            </div>

            {/* High Intensity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">High Intensity</span>
                <Badge variant="outline">{Math.round(state.displayConfig.highlightIntensityHigh * 100)}%</Badge>
              </div>
              <Slider
                min={5}
                max={60}
                step={1}
                value={[Math.round(state.displayConfig.highlightIntensityHigh * 100)]}
                onValueChange={(v) => void handleDisplayConfigChange({ highlightIntensityHigh: v[0] / 100 })}
              />
            </div>

            {/* Low Intensity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Low Intensity</span>
                <Badge variant="outline">{Math.round(state.displayConfig.highlightIntensityLow * 100)}%</Badge>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[Math.round(state.displayConfig.highlightIntensityLow * 100)]}
                onValueChange={(v) => void handleDisplayConfigChange({ highlightIntensityLow: v[0] / 100 })}
              />
            </div>

            {/* Spacer to balance 2-col grid */}
            <div />

            {/* Toggle: Underline */}
            <div className="flex items-center justify-between">
              <span className="text-xs">Show Underline</span>
              <Switch
                checked={state.displayConfig.showUnderline}
                onCheckedChange={(v) => void handleDisplayConfigChange({ showUnderline: v })}
              />
            </div>

            {/* Toggle: Entry Animation */}
            <div className="flex items-center justify-between">
              <span className="text-xs">Entry Animation</span>
              <Switch
                checked={state.displayConfig.showEntryAnimation}
                onCheckedChange={(v) => void handleDisplayConfigChange({ showEntryAnimation: v })}
              />
            </div>

            {/* Toggle: Bold Structural */}
            <div className="flex items-center justify-between">
              <span className="text-xs">Bold Structural Phrases</span>
              <Switch
                checked={state.displayConfig.boldStructural}
                onCheckedChange={(v) => void handleDisplayConfigChange({ boldStructural: v })}
              />
            </div>

            {/* Toggle: Italic Lexical */}
            <div className="flex items-center justify-between">
              <span className="text-xs">Italic Lexical Phrases</span>
              <Switch
                checked={state.displayConfig.italicLexical}
                onCheckedChange={(v) => void handleDisplayConfigChange({ italicLexical: v })}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Phrase Bank List */}
          <section className="flex flex-col h-[550px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Phrase Bank</h2>
              <span className="text-xs text-muted-foreground">
                Latest batch: {state.bank?.lastBatchId ? state.bank.lastBatchId.slice(0, 8) : "none"}
              </span>
            </div>
            
            <ScrollArea className="flex-1 rounded-md border border-border bg-muted/10">
              <div className="p-4 space-y-2">
                {phrases.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                    No phrases yet. Use the + button to trigger the planner and seed the bank.
                  </p>
                ) : (
                  phrases.map((phrase) => (
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
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        {phrase.exposures} exp
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </section>

          {/* Assessment History List */}
          {state.assessmentHistory && state.assessmentHistory.length > 0 && (
            <section className="flex flex-col h-[550px]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Assessment History</h2>
                <span className="text-xs text-muted-foreground">
                  {state.assessmentHistory.length} records
                </span>
              </div>
              <ScrollArea className="flex-1 rounded-md border border-border bg-muted/10">
                <div className="p-4 space-y-2">
                  {state.assessmentHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="font-medium text-[15px]">"{entry.phrase}"</div>
                        <Badge variant={entry.score >= 4 ? "default" : entry.score >= 2 ? "warning" : "muted"}>
                          {entry.score}/5
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        <span className="opacity-70">Translation attempt:</span> "{entry.userTranslation}"
                      </div>
                      <div className="text-right text-xs text-muted-foreground/50">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
