import { db } from "@/lib/db/orbita-db";
import { categorizeSpeed } from "@/lib/fsrs/assessment";

/** How many recent first tries set the learner's current success rate. */
const RECENT = 30;
/** Fewer than this and the rate is noise: no adjustment. */
const MIN_HISTORY = 10;

/**
 * New cards for the next session, from recent first tries (newest first).
 * Learning is fastest near 85% right: struggling means fewer new cards and
 * more review, cruising means a full session of new ones. Never zero, so a
 * session with nothing due still has work.
 */
export function adaptiveNewLimit(recent: readonly boolean[], sessionSize: number): number {
  const window = recent.slice(0, RECENT);
  if (window.length < MIN_HISTORY) return sessionSize;
  const rate = window.filter(Boolean).length / window.length;
  if (rate >= 0.85) return sessionSize;
  if (rate >= 0.75) return Math.ceil(sessionSize / 2);
  return Math.min(3, sessionSize);
}

/** Latest graded first tries, newest first (question_history only records the first grade per session). */
export async function readRecentFirstTries(): Promise<boolean[]> {
  try {
    const rows = await db().question_history.orderBy("answeredAt").reverse().limit(RECENT).toArray();
    return rows.map((r) => r.correct);
  } catch {
    // No history readable: behave as for a new learner.
    return [];
  }
}

/**
 * How long a miss stays on screen. A fast miss was a confident one, and those
 * are corrected best when the learner gets time to look (hypercorrection);
 * a slow, unsure miss moves on a little sooner.
 */
export function missFeedbackMs(responseMs: number, questionType: string, retrievalMode?: string): number {
  const speed = categorizeSpeed(responseMs, questionType, retrievalMode);
  if (speed === "very_fast") return 3500;
  if (speed === "slow" || speed === "very_slow") return 2000;
  return 2500;
}
