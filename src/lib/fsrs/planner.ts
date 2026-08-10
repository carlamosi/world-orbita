import type { ConceptProgressRow } from "../db/orbita-db";
import { retrievability } from "./engine";

/**
 * Counts concepts whose FSRS due timestamp is <= now across all provided rows.
 * Intended for displaying a live badge (e.g. "12 due").
 */
export function getDueTodayCount(allConcepts: ConceptProgressRow[]): number {
  const now = Date.now();
  return allConcepts.filter(
    (c) =>
      (c.fsrs_state === "learning" ||
        c.fsrs_state === "relearning" ||
        c.fsrs_state === "review") &&
      c.fsrs_due <= now
  ).length;
}

/**
 * Builds an ordered mixed-skill review queue containing EVERY concept that is
 * strictly due right now (fsrs_due <= now) across all provided skills.
 *
 * Priority order:
 *   1. Learning / Relearning cards (most urgent)
 *   2. Overdue Review cards (sorted most-overdue first)
 *   3. Weak cards (retrievability < 0.50, even if not technically due yet)
 *
 * No new cards are included — this is a pure review queue.
 * Anti-repetition constraints (same-country consecutive, same-skill 3x) are applied.
 */
export function generateDueTodayQueue(
  allConcepts: ConceptProgressRow[]
): ConceptProgressRow[] {
  const now = Date.now();

  const bucketA: ConceptProgressRow[] = []; // Learning / Relearning (due)
  const bucketB: ConceptProgressRow[] = []; // Review (due)
  const bucketC: ConceptProgressRow[] = []; // Weak (retrievability < 0.50)

  for (const concept of allConcepts) {
    if (
      concept.fsrs_state === "learning" ||
      concept.fsrs_state === "relearning"
    ) {
      if (concept.fsrs_due <= now) bucketA.push(concept);
    } else if (concept.fsrs_state === "review") {
      if (concept.fsrs_due <= now) {
        bucketB.push(concept);
      } else {
        const elapsedDays = Math.max(
          0,
          (now - concept.fsrs_last_review) / 86400000
        );
        const R = retrievability(concept.fsrs_stability, elapsedDays);
        if (R < 0.5) bucketC.push(concept);
      }
    }
    // "new" cards are intentionally excluded — use the per-mode planner for new cards
  }

  // Sort each bucket so the most overdue appears first
  const byOverdue = (a: ConceptProgressRow, b: ConceptProgressRow) =>
    a.fsrs_due - b.fsrs_due;
  bucketA.sort(byOverdue);
  bucketB.sort(byOverdue);
  bucketC.sort(byOverdue);

  const rawQueue = [...bucketA, ...bucketB, ...bucketC];
  return applyAntiRepetitionConstraints(rawQueue);
}

export interface PlannerConfig {
  maxNewPerSession?: number;
  sessionSize?: number;
}

/**
 * Generates an ordered queue of concepts to study based on FSRS priority buckets.
 */
export function generateSessionQueue(
  allConcepts: ConceptProgressRow[], 
  explorationIso3?: string, 
  config: PlannerConfig = {}
): ConceptProgressRow[] {
  const now = Date.now();
  const sessionSize = config.sessionSize || 20;
  const maxNew = config.maxNewPerSession || 5;
  
  const bucketA: ConceptProgressRow[] = []; // Learning / Relearning
  const bucketB: ConceptProgressRow[] = []; // Overdue / Due Review
  const bucketC: ConceptProgressRow[] = []; // Weak
  const bucketD: ConceptProgressRow[] = []; // Exploration context
  const bucketE: ConceptProgressRow[] = []; // New
  
  for (const concept of allConcepts) {
    if (concept.fsrs_state === "learning" || concept.fsrs_state === "relearning") {
      if (concept.fsrs_due <= now) {
        bucketA.push(concept);
      }
    } else if (concept.fsrs_state === "review") {
      if (concept.fsrs_due <= now) {
        bucketB.push(concept);
      } else {
        const elapsedDays = Math.max(0, (now - concept.fsrs_last_review) / 86400000);
        const R = retrievability(concept.fsrs_stability, elapsedDays);
        if (R < 0.50) {
          bucketC.push(concept);
        }
      }
    } else if (concept.fsrs_state === "new") {
      if (explorationIso3 && concept.iso3 === explorationIso3) {
        bucketD.push(concept);
      } else {
        bucketE.push(concept);
      }
    }
  }
  
  // Sort A & B by how overdue they are (due - now)
  bucketA.sort((a, b) => a.fsrs_due - b.fsrs_due);
  bucketB.sort((a, b) => a.fsrs_due - b.fsrs_due);
  
  // Build raw queue by appending buckets in priority order
  let rawQueue: ConceptProgressRow[] = [];
  rawQueue.push(...bucketA);
  rawQueue.push(...bucketB);
  rawQueue.push(...bucketC);
  rawQueue.push(...bucketD);
  rawQueue.push(...bucketE.slice(0, Math.max(0, maxNew - bucketD.length)));
  
  // Truncate to desired session size
  if (rawQueue.length > sessionSize) {
    rawQueue = rawQueue.slice(0, sessionSize);
  }
  
  return applyAntiRepetitionConstraints(rawQueue);
}

/**
 * Reorders the queue to prevent repetitive patterns (e.g. same skill 3x in a row, or same country consecutively).
 */
function applyAntiRepetitionConstraints(queue: ConceptProgressRow[]): ConceptProgressRow[] {
  if (queue.length <= 1) return queue;
  
  const result: ConceptProgressRow[] = [];
  const remaining = [...queue];
  
  // Greedy approach to satisfy constraints
  while (remaining.length > 0) {
    let bestIdx = 0;
    
    // Find the first item that doesn't violate constraints
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (isValidNext(result, candidate)) {
        bestIdx = i;
        break;
      }
    }
    
    // If no item is perfectly valid, we just take the first one to avoid infinite loop
    result.push(remaining.splice(bestIdx, 1)[0]);
  }
  
  return result;
}

function isValidNext(currentQueue: ConceptProgressRow[], nextItem: ConceptProgressRow): boolean {
  if (currentQueue.length === 0) return true;
  
  const last = currentQueue[currentQueue.length - 1];
  
  // 1. Do not ask about the exact same country consecutively
  if (last.iso3 === nextItem.iso3) return false;
  
  // 2. Do not ask the exact same skill type > 2 times consecutively
  if (currentQueue.length >= 2) {
    const secondLast = currentQueue[currentQueue.length - 2];
    if (last.skill === nextItem.skill && secondLast.skill === nextItem.skill) {
      return false;
    }
  }
  
  return true;
}
