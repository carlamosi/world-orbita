/**
 * ORBITA Answer Evaluation — separated from FSRS scheduling.
 *
 * This module answers: "how well did the learner answer this question?"
 * It produces:
 *   1. A ReviewOutcome for FSRS (correct / incorrect / ambiguous only)
 *   2. Rich behavioral signals for ORBITA's mode-selection policy
 *
 * It does NOT produce FSRS grades directly — that is the adapter's job.
 * It does NOT modify intervals, stability, or difficulty — that is ts-fsrs's job.
 */

import type { ReviewOutcome } from "./adapter";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  /** Primary correctness: did the learner supply the right answer? */
  correct: boolean;
  /**
   * Soft-correct: answer is functionally correct but not exact
   * (e.g., typo, accent omission, spelling variant, or geographic near-miss).
   * Treated as "ambiguous" by the adapter → Rating.Hard.
   */
  softCorrect: boolean;
}

export interface QuestionAttempt {
  validationResult: ValidationResult;
  responseMs: number;
  attemptNumber: number;    // 1 = first attempt
  hintsUsed: number;        // 0 = no hints
  /**
   * ORBITA question type: "location" | "capital" | "flag" | "name"
   * Used only for behavioral analysis, NOT for FSRS grading.
   */
  questionType: string;
  /**
   * ORBITA retrieval mode: "easy" | "hard" | "locate" | "speed"
   * Stored for ORBITA policy engine, NEVER used to modify FSRS intervals.
   */
  retrievalMode?: string;
  /**
   * ORBITA retrieval direction: "country->capital" | "capital->country" | etc.
   * Stored for ORBITA policy engine, NEVER used to modify FSRS intervals.
   */
  direction?: string;
}

/**
 * Evaluation result returned by assess().
 *
 * FSRS receives only `outcome` (via the adapter).
 * ORBITA's policy layer can use all fields for future mode selection.
 */
export interface AssessmentResult {
  /** Binary outcome for FSRS — the adapter maps this to Rating.Again/Hard/Good */
  outcome: ReviewOutcome;

  // ── Behavioral signals for ORBITA mode selection ──────────────────────────
  /** True if the answer was correct on the first attempt. */
  firstAttemptCorrect: boolean;
  /** True if hints were used. */
  hintsUsed: boolean;
  /** True if the answer was a near-miss (soft-correct). */
  wasNearMiss: boolean;
  /** Categorized response speed for this question type. */
  speed: "very_fast" | "normal" | "slow" | "very_slow";
  /** The retrieval mode used (echoed from input for storage). */
  retrievalMode: string;
  /** The retrieval direction (echoed from input for storage). */
  direction: string;
}

// ---------------------------------------------------------------------------
// Response-time thresholds per question type (informational only)
// ---------------------------------------------------------------------------

const TIME_THRESHOLDS: Record<string, { veryFast: number; slow: number; verySlow: number }> = {
  location: { veryFast: 2000,  slow: 12000, verySlow: 25000 },
  capital:  { veryFast: 4000,  slow: 20000, verySlow: 40000 },
  flag:     { veryFast: 1500,  slow: 8000,  verySlow: 15000 },
  name:     { veryFast: 3000,  slow: 15000, verySlow: 30000 },
  _default: { veryFast: 3000,  slow: 15000, verySlow: 30000 },
};

function categorizeSpeed(
  responseMs: number,
  questionType: string,
): AssessmentResult["speed"] {
  const t = TIME_THRESHOLDS[questionType] ?? TIME_THRESHOLDS["_default"]!;
  if (responseMs <= t.veryFast) return "very_fast";
  if (responseMs >= t.verySlow) return "very_slow";
  if (responseMs >= t.slow) return "slow";
  return "normal";
}

// ---------------------------------------------------------------------------
// Core evaluation — pure function
// ---------------------------------------------------------------------------

/**
 * Evaluates a question attempt and returns a structured assessment.
 *
 * FSRS grading is conservative: only the primary correctness signal matters.
 *   - correct   → "correct"   → Rating.Good
 *   - incorrect → "incorrect" → Rating.Again
 *   - soft-correct (near-miss) → "ambiguous" → Rating.Hard
 *
 * Response time, hints, and attempt count are behavioral signals ONLY.
 * They do NOT adjust FSRS intervals.
 */
export function assess(attempt: QuestionAttempt): AssessmentResult {
  const { validationResult, responseMs, attemptNumber, hintsUsed, questionType } = attempt;

  // ── Primary FSRS outcome ─────────────────────────────────────────────────
  let outcome: ReviewOutcome;

  if (!validationResult.correct) {
    // Definitively wrong — unambiguous memory failure
    outcome = "incorrect";
  } else if (validationResult.softCorrect) {
    // Functionally correct but not exact — partial recall
    outcome = "ambiguous";
  } else {
    // Clean correct answer
    outcome = "correct";
  }

  // ── Behavioral signals for ORBITA policy (NOT for FSRS) ──────────────────
  const speed = categorizeSpeed(responseMs, questionType);

  return {
    outcome,
    firstAttemptCorrect: validationResult.correct && attemptNumber === 1,
    hintsUsed: hintsUsed > 0,
    wasNearMiss: validationResult.softCorrect,
    speed,
    retrievalMode: attempt.retrievalMode ?? "unknown",
    direction: attempt.direction ?? "unknown",
  };
}
