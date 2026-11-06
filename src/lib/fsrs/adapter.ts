/**
 * ORBITA ↔ ts-fsrs Adapter
 *
 * This is the ONLY file in the codebase that imports from ts-fsrs.
 * All other ORBITA code interacts with ts-fsrs exclusively through this module.
 *
 * Architectural contract:
 *   ORBITA  → decides WHAT and HOW to test (mode, direction, retrieval format)
 *   ADAPTER → translates ORBITA review outcomes into official FSRS card transitions
 *   ts-fsrs → decides WHEN to schedule the next review (interval, stability, difficulty)
 *
 * The adapter NEVER:
 *   - inspects game mode, question direction, or UI format to alter intervals
 *   - manually clamps, multiplies, or overrides ts-fsrs intervals
 *   - re-implement FSRS mathematics
 *
 * Grade policy (conservative / learning-science grounded):
 *   incorrect  → Rating.Again  (memory trace not recalled)
 *   correct    → Rating.Good   (memory trace successfully recalled)
 *   ambiguous  → Rating.Hard   (partial recall: typo, hints, very slow)
 *   Easy is never produced by automatic grading (see assessment.ts).
 *
 * The history row's `grade` is Rating - 1 (0 Again, 1 Hard, 2 Good, 3 Easy);
 * it is not a Rating value, so do not feed it back into ts-fsrs.
 *
 * Easy vs Hard mode differences influence ORBITA's question-selection policy
 * (see planner.ts ModeSelectionPolicy) but NEVER alter the FSRS interval.
 */

import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type Grade,
  type RecordLogItem,
  type FSRSParameters,
} from "ts-fsrs";
import type { ConceptProgressRow } from "../db/orbita-db";

// ---------------------------------------------------------------------------
// Singleton FSRS instance — default FSRS-6 parameters
// ---------------------------------------------------------------------------
let _fsrsInstance = fsrs({
  // Standard 90% retention target — balances review load vs forgetting risk
  request_retention: 0.9,
  // Enable short-term learning steps (1m → 10m for new/wrong cards)
  // Without this, wrong cards get scheduled days out instead of minutes
  enable_short_term: true,
  // Add slight fuzz to long intervals to prevent card bunching
  enable_fuzz: true,
  // Cap at 100 years (36500 days) — prevents rare edge-case stability runaway
  maximum_interval: 36500,
});

/** Re-initialize with custom params (e.g., for testing or advanced users). */
export function configureFsrs(params: Partial<FSRSParameters>): void {
  _fsrsInstance = fsrs(params);
}

/** Read-only access to the active FSRS parameters (used by the session engine). */
export function getFsrsParameters(): FSRSParameters {
  return _fsrsInstance.parameters;
}

// ---------------------------------------------------------------------------
// Review outcome type — this is what ORBITA feeds the adapter
// ---------------------------------------------------------------------------

/** Strict binary outcome after answer evaluation. */
export type ReviewOutcome = "again" | "hard" | "good" | "easy";

/**
 * A normalized review event emitted by every ORBITA game mode.
 *
 * NOTE: mode and direction carry learning metadata for ORBITA's policy engine.
 * They do NOT affect FSRS mathematics.
 */
export interface NormalizedReview {
  conceptId: string;
  /** Binary result of answer evaluation — the ONLY thing fed to FSRS grading. */
  outcome: ReviewOutcome;
  /** ORBITA question mode: "easy" | "hard" | "locate" | "speed" etc. */
  mode: string;
  /** Retrieval direction: "country->capital" | "capital->country" | "flag->country" | etc. */
  direction: string;
  /** Wall-clock time of the answer in ms since epoch. */
  reviewedAt: number;
  /** Raw response latency in ms (from question shown → answer submitted). */
  responseMs: number;
  /** Whether the answer was near-miss / soft-correct (typo, spelling). */
  softCorrect?: boolean;
  /** Session identifier for grouping. */
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Card conversion helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh ts-fsrs card for a brand-new concept.
 * Returns a card in State.New with due = now.
 */
export function createNewCard(nowMs = Date.now()): Card {
  const card = createEmptyCard(new Date(nowMs));
  return card;
}

/**
 * Map an ORBITA ConceptProgressRow → ts-fsrs Card.
 *
 * Migration safety: existing rows may have string state from the old custom
 * engine ('new' | 'learning' | 'review' | 'relearning'). We normalize those
 * to official numeric State values here so this conversion is idempotent.
 */
export function rowToCard(row: ConceptProgressRow): Card {
  const card = createEmptyCard();

  // State normalization — handles both old string states and new numeric states
  card.state = normalizeState(row.fsrs_state);

  card.due = new Date(row.fsrs_due || Date.now());
  card.stability = row.fsrs_stability ?? 0;
  card.difficulty = row.fsrs_difficulty ?? 0;
  if (card.state !== State.New) {
    // ts-fsrs throws "Invalid memory state" for d < 1 or s < 0.001 outside New.
    // Only repair invalid values; valid ones stay as stored.
    if (!(card.difficulty >= 1)) card.difficulty = 5;
    if (!(card.stability > 0)) card.stability = card.state === State.Review ? 1 : 0.1;
  }
  card.reps = row.fsrs_reps ?? 0;
  card.lapses = row.fsrs_lapses ?? 0;
  card.elapsed_days = Math.max(0, row.fsrs_elapsed_days ?? 0); // a future last_review makes ts-fsrs report negative days
  card.scheduled_days = row.fsrs_scheduled_days ?? 0;
  card.learning_steps = learningStepsOf(row, card.state);

  if (row.fsrs_last_review && row.fsrs_last_review > 0) {
    card.last_review = new Date(row.fsrs_last_review);
  }

  return card;
}

const TEN_MIN_MS = 10 * 60_000;

/**
 * FSRS-1: the short-term step index. Rows written before the field existed are
 * derived for Learning only: the default steps are 1m then 10m, so a gap
 * of 10 min or more between last review and due means the card is at step 1.
 */
export function learningStepsOf(
  row: ConceptProgressRow,
  state: State = normalizeState(row.fsrs_state),
): number {
  const stored = row.fsrs_learning_steps;
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0) return stored;
  // Relearning: the default relearning_steps is ['10m'], a single step, so a
  // legacy row can only be at step 0 (deriving 1 would graduate Again/Hard).
  if (state !== State.Learning) return 0;
  if (!row.fsrs_last_review || !row.fsrs_due) return 0;
  return row.fsrs_due - row.fsrs_last_review >= TEN_MIN_MS ? 1 : 0;
}

/** Normalize state from legacy string or official numeric to ts-fsrs State enum. */
export function normalizeState(raw: unknown): State {
  if (typeof raw === "number") {
    // Already numeric — validate it's in range
    if (raw === State.New || raw === State.Learning || raw === State.Review || raw === State.Relearning) {
      return raw as State;
    }
    return State.New;
  }
  if (typeof raw === "string") {
    // Numeric string from Supabase TEXT column (e.g. "0", "1", "2", "3")
    const asNum = Number(raw);
    if (!isNaN(asNum) && Number.isInteger(asNum)) {
      if (asNum === State.New || asNum === State.Learning || asNum === State.Review || asNum === State.Relearning) {
        return asNum as State;
      }
      return State.New;
    }
    // Legacy string states from old engine
    const map: Record<string, State> = {
      new: State.New,
      learning: State.Learning,
      review: State.Review,
      relearning: State.Relearning,
    };
    return map[raw] ?? State.New;
  }
  return State.New;
}

/**
 * Map an updated ts-fsrs Card back to a partial ConceptProgressRow update.
 * Returns only the scheduling fields — callers merge with their existing row.
 */
export function cardToRowUpdates(
  card: Card,
  dirty: 0 | 1 = 1,
  bumpVersion = true,
  currentVersion = 0,
): Partial<ConceptProgressRow> {
  const now = Date.now();
  return {
    fsrs_state: card.state,
    fsrs_due: card.due.getTime(),
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_last_review: (card.last_review ?? new Date(now)).getTime(),
    fsrs_elapsed_days: Math.max(0, card.elapsed_days),
    fsrs_scheduled_days: card.scheduled_days,
    fsrs_learning_steps: card.learning_steps,
    updated_at: now,
    dirty,
    ...(bumpVersion ? { version: currentVersion + 1 } : {}),
  };
}

// ---------------------------------------------------------------------------
// Core scheduling transition — the ONLY place ts-fsrs.next() is called
// ---------------------------------------------------------------------------

export interface ProcessReviewResult {
  /** Updated card — persist this back to Dexie */
  card: Card;
  /** The raw ts-fsrs RecordLogItem — serializable for audit log */
  log: RecordLogItem;
  /** The FSRS grade applied — for transparency/testing */
  grade: Grade;
}

/**
 * Process a normalized review outcome through the official FSRS-6 scheduler.
 *
 * This is the single entry point for all FSRS state transitions in ORBITA.
 *
 * Grade mapping:
 *   incorrect  → Rating.Again  (1)
 *   ambiguous  → Rating.Hard   (2)  — soft-correct, near-miss
 *   correct    → Rating.Good   (3)
 *
 * IMPORTANT: The `mode` and `direction` in the review are stored in the
 * history row but NEVER affect the grade assigned to FSRS.
 */
export function processReview(
  currentCard: Card,
  outcome: ReviewOutcome,
  reviewedAtMs: number,
): ProcessReviewResult {
  const now = new Date(reviewedAtMs);

  const grade: Grade = outcomeToGrade(outcome);
  const logItem = _fsrsInstance.next(currentCard, now, grade);

  return {
    card: logItem.card,
    log: logItem,
    grade,
  };
}

/** Conservative grade mapping: correctness → FSRS rating. Mode-agnostic. */
export function outcomeToGrade(outcome: ReviewOutcome): Grade {
  switch (outcome) {
    case "again":
      return Rating.Again; // 1
    case "hard":
      return Rating.Hard;  // 2
    case "good":
      return Rating.Good;  // 3
    case "easy":
      return Rating.Easy;  // 4
  }
}

// ---------------------------------------------------------------------------
// isDue — canonical eligibility function
// ---------------------------------------------------------------------------

/**
 * Canonical Due Today check. This is the SINGLE definition of "is this card due?"
 *
 * An item is due if and only if its FSRS-scheduled due timestamp <= now.
 * Overdue items (due yesterday) are always due.
 * Future items are never due.
 *
 * Do NOT use retrievability < threshold as an alternative due trigger.
 * The FSRS scheduler already accounts for forgetting probability in its intervals.
 */
export function isDue(row: ConceptProgressRow, nowMs = Date.now()): boolean {
  // New cards (never reviewed) are always immediately eligible
  if (normalizeState(row.fsrs_state) === State.New) return true;
  return row.fsrs_due <= nowMs;
}

/** Days of stability a Review card needs to count as mastered. */
export const MASTERED_STABILITY_DAYS = 21;

/** A mastered card: in Review and stable for 21+ days (retrievability alone is near 1 right after any review). */
export function isMastered(row: ConceptProgressRow): boolean {
  return (
    normalizeState(row.fsrs_state) === State.Review &&
    (row.fsrs_stability ?? 0) >= MASTERED_STABILITY_DAYS
  );
}

/**
 * Returns the retrievability (probability of recall) for a concept.
 * This is informational only — it must NOT be used as a scheduling trigger.
 *
 * NOTE on learning/relearning cards:
 * At the moment of review (`nowMs ≈ last_review`), pure mathematical retrievability
 * is 100% because 0 days have elapsed. For cards in State.Learning or State.Relearning
 * (freshly failed / in short-term recovery), we reflect their active failure / low stability
 * so mastery gauges and progress bars drop immediately upon a wrong answer.
 */
export function getRetrievability(row: ConceptProgressRow, nowMs = Date.now()): number {
  const st = normalizeState(row.fsrs_state);
  if (st === State.New) return 0;
  
  const card = rowToCard(row);
  let r = 0;
  try {
    const rawR = _fsrsInstance.get_retrievability(card, new Date(nowMs), false) as number;
    r = Number.isFinite(rawR) ? rawR : 0;
  } catch {
    r = 0;
  }

  // If the card is in learning/relearning (failed/lapsed), cap/scale retrievability
  // based on stability so it does not falsely display 100% immediately after failure.
  if (st === State.Learning || st === State.Relearning) {
    const stability = row.fsrs_stability ?? 0.2;
    // Scale by stability (min 0.1, max 0.45)
    return Math.max(0.1, Math.min(0.45, stability * 0.5));
  }

  return r;
}

// ---------------------------------------------------------------------------
// Mode Selection Policy — ORBITA-level, separate from FSRS
// ---------------------------------------------------------------------------

/**
 * Signals from past performance on a specific concept, across modes.
 * Used by ORBITA's policy layer to decide HOW to test next — not WHEN.
 */
export interface ModePerformanceSignals {
  conceptId: string;
  easyCorrectRate: number;   // 0-1 — ratio of correct answers in easy mode
  hardCorrectRate: number;   // 0-1 — ratio of correct answers in hard mode
  easyAttempts: number;
  hardAttempts: number;
  directionalBalance: number; // e.g., how many Country->Capital vs Capital->Country
  recentFailedModes: string[];
  fsrsState: State;
  fsrsStability: number;
}

/**
 * Selects the recommended retrieval mode for the next question.
 *
 * This function deliberately ignores FSRS stability thresholds.
 * It uses ORBITA behavioral signals to encourage balanced retrieval:
 *
 *   - If hard-mode performance is much weaker than easy → prefer hard (productive struggle)
 *   - If both modes are strong → vary modality and direction
 *   - If both modes are weak → prefer easy (reduce frustration, build foundation)
 *   - Always avoid showing the same mode 3x in a row (interleaving)
 *
 * Returns a preference, not a mandate — callers may override for variety.
 */
export function selectRecommendedMode(
  signals: ModePerformanceSignals,
  recentModes: string[],
): "easy" | "hard" | "vary" {
  const { easyCorrectRate, hardCorrectRate, easyAttempts, hardAttempts } = signals;

  // Not enough data — start easy
  if (easyAttempts < 3) return "easy";

  // Hard never attempted — introduce it after easy competence
  if (hardAttempts === 0 && easyCorrectRate >= 0.8) return "hard";
  if (hardAttempts === 0) return "easy";

  // Both weak → stay easy
  if (easyCorrectRate < 0.5 && hardCorrectRate < 0.5) return "easy";

  // Easy strong, hard weak → push hard (desirable difficulty)
  if (easyCorrectRate >= 0.7 && hardCorrectRate < 0.6) return "hard";

  // Both strong → vary to prevent rote/pattern recognition
  if (easyCorrectRate >= 0.8 && hardCorrectRate >= 0.8) return "vary";

  // Avoid 3x same mode in a row
  if (recentModes.length >= 3) {
    const last3 = recentModes.slice(-3);
    if (last3.every((m) => m === "easy")) return "hard";
    if (last3.every((m) => m === "hard")) return "easy";
  }

  return "vary";
}
