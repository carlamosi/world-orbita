/**
 * Wire payload builders for the v2 sync contract (sync_push).
 *
 * Every date is a JSON number of epoch ms: the server rejects ISO strings and
 * numeric strings with `invalid_payload`. Dexie-internal fields (dirty,
 * user_id) never go on the wire; the RPC scopes rows with auth.uid().
 */
import type {
  ConceptProgressRow,
  CountryProgressRow,
  GameSessionRow,
  QuestionHistoryRow,
  UnlockRow,
} from "@/lib/db/orbita-db";
import { learningStepsOf } from "@/lib/fsrs/adapter";

export function countryProgressPayload(row: CountryProgressRow, fallbackMs = Date.now()) {
  return {
    country_code: row.iso3,
    skills: row.skills,
    skill_versions: row.skill_versions ?? {},
    last_seen_at: row.lastSeenAt || fallbackMs,
  };
}

export function unlockPayload(u: Pick<UnlockRow, "key" | "progress" | "unlockedAt">) {
  return {
    key: u.key,
    progress: u.progress,
    unlocked_at: u.unlockedAt ? u.unlockedAt : null,
  };
}

export function sessionsLogPayload(row: Omit<GameSessionRow, "id">) {
  return {
    mode: row.mode,
    skill: row.skill,
    score: row.score,
    total_questions: row.totalQuestions,
    correct: row.correct,
    wrong: row.wrong,
    best_combo: row.bestCombo,
    duration_ms: row.durationMs,
    period_key: row.periodKey,
    meta: row.meta,
    started_at: row.createdAt - row.durationMs,
    ended_at: row.createdAt,
  };
}

export function dailyStreakPayload(dateKey: string, activeAtMs: number) {
  return { date_key: dateKey, count: 1, last_active_at: activeAtMs };
}

let warnedNeverReviewed = false;

/**
 * Concept payload, or null when the row was never reviewed: the server
 * requires fsrs_last_review > 2000-01-01 and would reject it as
 * invalid_payload forever (Ruling 6c). Logged once per page load.
 */
export function conceptProgressPayload(row: ConceptProgressRow): Record<string, unknown> | null {
  if (!(row.fsrs_last_review > 0)) {
    if (!warnedNeverReviewed) {
      warnedNeverReviewed = true;
      console.warn(
        "[sync] skipping concept_progress with fsrs_last_review <= 0 (never reviewed):",
        row.conceptId,
      );
    }
    return null;
  }
  return {
    conceptId: row.conceptId,
    iso3: row.iso3,
    skill: row.skill,
    fsrs_state: row.fsrs_state,
    fsrs_stability: row.fsrs_stability,
    fsrs_difficulty: row.fsrs_difficulty,
    fsrs_due: row.fsrs_due,
    fsrs_reps: row.fsrs_reps,
    fsrs_lapses: row.fsrs_lapses,
    fsrs_last_review: row.fsrs_last_review,
    fsrs_elapsed_days: row.fsrs_elapsed_days ?? 0,
    fsrs_scheduled_days: row.fsrs_scheduled_days ?? 0,
    fsrs_learning_steps: learningStepsOf(row),
    // Ignored by the v2 server (it assigns version and updated_at).
    version: row.version,
    updated_at: row.updated_at,
  };
}

export function questionHistoryPayload(h: QuestionHistoryRow) {
  return {
    op_id: h.op_id,
    conceptId: h.conceptId,
    sessionId: h.sessionId,
    grade: h.grade,
    mode: h.mode,
    direction: h.direction,
    fsrs_log: h.fsrs_log,
    responseMs: h.responseMs,
    correct: h.correct,
    answeredAt: h.answeredAt,
  };
}
