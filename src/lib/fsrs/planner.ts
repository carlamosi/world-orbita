/**
 * ORBITA Session Planner
 *
 * Responsible for building review queues from ConceptProgressRows.
 * Uses the canonical `isDue()` from the adapter — single source of truth.
 *
 * Architectural rules:
 *   - Due Today count and review queue MUST use the identical eligibility check.
 *   - No second algorithm based on retrievability < threshold as a scheduling trigger.
 *   - The planner decides WHICH concepts and WHAT order — not WHEN they are due.
 *   - FSRS state transitions happen in the adapter, never here.
 */

import type { ConceptProgressRow } from "../db/orbita-db";
import { isDue, normalizeState } from "./adapter";
import { State } from "ts-fsrs";

// ---------------------------------------------------------------------------
// Canonical Due Today
// ---------------------------------------------------------------------------

/**
 * Canonical eligibility predicate. Used by BOTH:
 *   1. getDueTodayCount() — badge counter
 *   2. generateDueTodayQueue() — actual review queue
 *
 * A concept is due if:
 *   - It has never been reviewed (State.New), OR
 *   - fsrs_due <= now (overdue or due right now)
 *
 * Future-due cards (fsrs_due > now) are NEVER included.
 */
export function isConceptDue(row: ConceptProgressRow, nowMs = Date.now()): boolean {
  return isDue(row, nowMs);
}

/**
 * Counts concepts due right now.
 * Uses isConceptDue — identical to the queue filter.
 */
export function getDueTodayCount(
  allConcepts: ConceptProgressRow[],
  nowMs = Date.now(),
): number {
  return allConcepts.filter((c) => isConceptDue(c, nowMs)).length;
}

// ---------------------------------------------------------------------------
// Due Today Queue
// ---------------------------------------------------------------------------

/**
 * Builds an ordered review queue of ALL due concepts.
 *
 * Priority order:
 *   1. Relearning cards (lapsed, needs immediate reinforcement)
 *   2. Learning cards (in-progress, must complete steps)
 *   3. Overdue Review cards (most overdue first — high forgetting risk)
 *   4. New cards (never reviewed)
 *
 * Anti-repetition constraints applied: same-country not consecutive,
 * same-skill not 3x in a row.
 */
export function generateDueTodayQueue(
  allConcepts: ConceptProgressRow[],
  nowMs = Date.now(),
): ConceptProgressRow[] {
  const bucketRelearning: ConceptProgressRow[] = [];
  const bucketLearning: ConceptProgressRow[] = [];
  const bucketReview: ConceptProgressRow[] = [];
  const bucketNew: ConceptProgressRow[] = [];

  for (const concept of allConcepts) {
    if (!isConceptDue(concept, nowMs)) continue;

    const state = normalizeState(concept.fsrs_state);
    switch (state) {
      case State.Relearning:
        bucketRelearning.push(concept);
        break;
      case State.Learning:
        bucketLearning.push(concept);
        break;
      case State.Review:
        bucketReview.push(concept);
        break;
      case State.New:
      default:
        bucketNew.push(concept);
        break;
    }
  }

  // Most overdue first within each bucket
  const byOverdue = (a: ConceptProgressRow, b: ConceptProgressRow) =>
    a.fsrs_due - b.fsrs_due;
  bucketRelearning.sort(byOverdue);
  bucketLearning.sort(byOverdue);
  bucketReview.sort(byOverdue);
  bucketNew.sort((a, b) => a.conceptId.localeCompare(b.conceptId));

  const rawQueue = [
    ...bucketRelearning,
    ...bucketLearning,
    ...bucketReview,
    ...bucketNew,
  ];

  return applyAntiRepetitionConstraints(rawQueue);
}

// ---------------------------------------------------------------------------
// Session Queue (for regular practice with new card injection)
// ---------------------------------------------------------------------------

export interface PlannerConfig {
  maxNewPerSession?: number;
  sessionSize?: number;
}

/**
 * Generates an ordered queue for a regular practice session.
 *
 * Combines:
 *   - All due concepts (in priority order)
 *   - Up to `maxNewPerSession` new concepts (exploration context first)
 *
 * Truncated to `sessionSize`.
 */
export function generateSessionQueue(
  allConcepts: ConceptProgressRow[],
  explorationIso3?: string,
  config: PlannerConfig = {},
  nowMs = Date.now(),
): ConceptProgressRow[] {
  const sessionSize = config.sessionSize ?? 10;
  const maxNew = config.maxNewPerSession ?? 10;

  const bucketRelearning: ConceptProgressRow[] = [];
  const bucketLearning: ConceptProgressRow[] = [];
  const bucketReview: ConceptProgressRow[] = [];
  const bucketExplore: ConceptProgressRow[] = []; // New cards for current country
  const bucketNew: ConceptProgressRow[] = [];     // New cards from elsewhere

  for (const concept of allConcepts) {
    const state = normalizeState(concept.fsrs_state);

    if (state === State.New) {
      if (explorationIso3 && concept.iso3 === explorationIso3) {
        bucketExplore.push(concept);
      } else {
        bucketNew.push(concept);
      }
      continue;
    }

    if (!isConceptDue(concept, nowMs)) continue;

    switch (state) {
      case State.Relearning:
        bucketRelearning.push(concept);
        break;
      case State.Learning:
        bucketLearning.push(concept);
        break;
      case State.Review:
        bucketReview.push(concept);
        break;
    }
  }

  const byOverdue = (a: ConceptProgressRow, b: ConceptProgressRow) =>
    a.fsrs_due - b.fsrs_due;
  bucketRelearning.sort(byOverdue);
  bucketLearning.sort(byOverdue);
  bucketReview.sort(byOverdue);

  // Inject new cards up to maxNew limit
  const newSlots = Math.max(0, maxNew);
  const exploreToAdd = bucketExplore.slice(0, newSlots);
  const newToAdd = bucketNew.slice(0, Math.max(0, newSlots - exploreToAdd.length));

  let rawQueue: ConceptProgressRow[] = [
    ...bucketRelearning,
    ...bucketLearning,
    ...bucketReview,
    ...exploreToAdd,
    ...newToAdd,
  ];

  if (rawQueue.length > sessionSize) {
    rawQueue = rawQueue.slice(0, sessionSize);
  }

  return applyAntiRepetitionConstraints(rawQueue);
}

// ---------------------------------------------------------------------------
// Anti-repetition (interleaving) constraint
// ---------------------------------------------------------------------------

/**
 * Reorders a queue to prevent repetitive patterns while preserving
 * overall priority. Greedy constraint-satisfaction approach.
 *
 * Prevents:
 *   - Same country consecutively (Algeria location → Algeria capital = bad)
 *   - Same skill 3+ times in a row
 */
function applyAntiRepetitionConstraints(
  queue: ConceptProgressRow[],
): ConceptProgressRow[] {
  if (queue.length <= 1) return queue;

  const result: ConceptProgressRow[] = [];
  const remaining = [...queue];

  while (remaining.length > 0) {
    // Find first item that satisfies both constraints
    let bestIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      if (isValidNext(result, remaining[i]!)) {
        bestIdx = i;
        break;
      }
    }
    // If nothing satisfies constraints perfectly, take first to avoid infinite loop
    result.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return result;
}

function isValidNext(
  currentQueue: ConceptProgressRow[],
  nextItem: ConceptProgressRow,
): boolean {
  if (currentQueue.length === 0) return true;

  const last = currentQueue[currentQueue.length - 1]!;

  // Constraint 1: Do not ask about the same country consecutively
  if (last.iso3 === nextItem.iso3) return false;

  // Constraint 2: Same skill type not 3+ times in a row
  if (currentQueue.length >= 2) {
    const secondLast = currentQueue[currentQueue.length - 2]!;
    if (last.skill === nextItem.skill && secondLast.skill === nextItem.skill) {
      return false;
    }
  }

  return true;
}
