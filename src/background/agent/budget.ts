import type { ExtractedParagraph, ReplacementBudget, UserContext } from "@/shared/types";

const BASE_RATIO = 0.05;
const MAX_PHRASES_PER_PARAGRAPH = 2;
const MAX_CONSECUTIVE_REPLACED = 1;
const MIN_PARAGRAPH_WORDS = 15;

interface BudgetCandidate {
  paragraphIndex: number;
  weight: number;
  cap: number;
  assigned: number;
  remainder: number;
}

function getParagraphPhaseMultiplier(position: number, totalParagraphs: number): number {
  if (totalParagraphs === 0) {
    return 0;
  }

  const percentile = (position + 1) / totalParagraphs;

  if (percentile <= 0.3) {
    return 1;
  }

  if (percentile <= 0.8) {
    return 1;
  }

  return 0.5;
}

export function calculateBudget(
  paragraphs: ExtractedParagraph[],
  userContext: UserContext,
): ReplacementBudget {
  const adjustedRatio = userContext.immersionIntensity * BASE_RATIO * 20;
  const fatigueMultiplier = userContext.sessionFatigueSignal ? 0.5 : 1.0;
  const depthMultiplier = Math.max(0.5, 1 - userContext.sessionDepth * 0.1);
  const finalRatio = adjustedRatio * fatigueMultiplier * depthMultiplier;

  // Convert the 0.05-0.70 immersion scale into the intended 0.5%-7.0% replacement share.
  const effectiveWordRatio = finalRatio / 10;
  const rawTotalBudget = Math.round(
    paragraphs.reduce((sum, paragraph) => sum + paragraph.wordCount, 0) * effectiveWordRatio,
  );

  const candidates: BudgetCandidate[] = paragraphs.map((paragraph, position) => {
    if (paragraph.wordCount < MIN_PARAGRAPH_WORDS) {
      return {
        paragraphIndex: paragraph.index,
        weight: 0,
        cap: 0,
        assigned: 0,
        remainder: 0,
      };
    }

    return {
      paragraphIndex: paragraph.index,
      weight: paragraph.wordCount * getParagraphPhaseMultiplier(position, paragraphs.length),
      cap: MAX_PHRASES_PER_PARAGRAPH,
      assigned: 0,
      remainder: 0,
    };
  });

  const totalCap = candidates.reduce((sum, candidate) => sum + candidate.cap, 0);
  const totalBudget = Math.max(0, Math.min(rawTotalBudget, totalCap));
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);

  if (totalBudget > 0 && totalWeight > 0) {
    for (const candidate of candidates) {
      if (candidate.cap === 0 || candidate.weight === 0) {
        continue;
      }

      const exactAllocation = (candidate.weight / totalWeight) * totalBudget;
      candidate.assigned = Math.min(candidate.cap, Math.floor(exactAllocation));
      candidate.remainder = exactAllocation - Math.floor(exactAllocation);
    }

    let remaining = totalBudget - candidates.reduce((sum, candidate) => sum + candidate.assigned, 0);

    const distributionOrder = [...candidates].sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }

      return right.weight - left.weight;
    });

    for (const candidate of distributionOrder) {
      if (remaining === 0) {
        break;
      }

      if (candidate.assigned >= candidate.cap) {
        continue;
      }

      candidate.assigned += 1;
      remaining -= 1;
    }
  }

  const perParagraph = Object.fromEntries(
    candidates.map((candidate) => [candidate.paragraphIndex, candidate.assigned]),
  );

  return {
    totalBudget,
    perParagraph,
    maxPhrasesPerParagraph: MAX_PHRASES_PER_PARAGRAPH,
    maxConsecutiveReplaced: MAX_CONSECUTIVE_REPLACED,
  };
}
