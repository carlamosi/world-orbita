/**
 * Apply server rows (sync_pull pages and sync_push canonicals) to Dexie.
 *
 * Every apply is idempotent: the first pull page of a cycle deliberately
 * re-reads up to 15 s of rows (see cursor.ts), so applying the same row twice
 * must leave Dexie unchanged. All server dates are epoch ms numbers.
 */
import { db } from "@/lib/db/orbita-db";
import type { ConceptProgressRow, DailySummaryRow, QuestionHistoryRow } from "@/lib/db/orbita-db";
import { normalizeState } from "@/lib/fsrs/adapter";

type Row = Record<string, unknown>;

const num = (v: unknown, dflt = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const optNum = (v: unknown): number | null => (v == null ? null : num(v));

/** Server concept row (pull row / stale_review canonical) -> Dexie row. */
export function serverConceptToRow(row: Row, userId: string | null): ConceptProgressRow {
  return {
    conceptId: String(row.conceptId),
    iso3: String(row.iso3),
    skill: String(row.skill),
    user_id: userId,
    fsrs_state: normalizeState(row.fsrs_state),
    fsrs_stability: optNum(row.fsrs_stability),
    fsrs_difficulty: optNum(row.fsrs_difficulty),
    fsrs_due: num(row.fsrs_due),
    fsrs_reps: num(row.fsrs_reps),
    fsrs_lapses: num(row.fsrs_lapses),
    fsrs_last_review: num(row.fsrs_last_review),
    fsrs_elapsed_days: num(row.fsrs_elapsed_days),
    fsrs_scheduled_days: num(row.fsrs_scheduled_days),
    fsrs_learning_steps: num(row.fsrs_learning_steps),
    version: num(row.version),
    updated_at: num(row.updated_at, Date.now()),
    dirty: 0,
  };
}

/**
 * Pull merge rule for concepts. The server version is a server counter and is
 * not comparable with local versions, so the latest review decides: apply when
 * there is no local row, when the server review is newer, or when it is equal
 * and the local row has no unpushed change.
 */
export function shouldApplyPulledConcept(local: ConceptProgressRow | undefined, row: Row): boolean {
  if (!local) return true;
  const server = num(row.fsrs_last_review);
  if (server > local.fsrs_last_review) return true;
  return server === local.fsrs_last_review && local.dirty !== 1;
}

/** Ruling 6e: a day's totals merge with max per column; the dirty flag is kept. */
export function mergeDailySummary(local: DailySummaryRow | undefined, row: Row): DailySummaryRow {
  const pulled = {
    reviewsCount: num(row.reviewsCount),
    correctCount: num(row.correctCount),
    timeSpentMs: num(row.timeSpentMs),
  };
  if (!local) {
    return {
      dateKey: String(row.dateKey),
      ...pulled,
      updated_at: num(row.updated_at, Date.now()),
      dirty: 0,
    };
  }
  return {
    ...local,
    reviewsCount: Math.max(local.reviewsCount, pulled.reviewsCount),
    correctCount: Math.max(local.correctCount, pulled.correctCount),
    timeSpentMs: Math.max(local.timeSpentMs, pulled.timeSpentMs),
  };
}

function serverHistoryToRow(row: Row): QuestionHistoryRow {
  return {
    op_id: String(row.op_id),
    conceptId: String(row.conceptId),
    sessionId: String(row.sessionId ?? ""),
    grade: num(row.grade),
    mode: String(row.mode ?? ""),
    direction: String(row.direction ?? ""),
    fsrs_log: row.fsrs_log ?? null,
    responseMs: num(row.responseMs),
    correct: row.correct === true,
    answeredAt: num(row.answeredAt),
  };
}

async function applyCountry(row: Row) {
  await db().countryProgress.put({
    iso3: String(row.country_code),
    skills: (row.skills ?? {}) as never,
    skill_versions: (row.skill_versions ?? {}) as never,
    lastSeenAt: row.last_seen_at != null ? num(row.last_seen_at, Date.now()) : Date.now(),
    updated_at: Date.now(),
    dirty: 0,
  });
}

/** Apply one pull page for one entity. Per-row failures are swallowed. */
export async function applyPulledRows(
  entity: string,
  rows: Row[],
  userId: string | null,
): Promise<void> {
  for (const row of rows) {
    try {
      if (entity === "country_progress") {
        await applyCountry(row);
      } else if (entity === "unlocks") {
        await db().unlocks.put({
          key: String(row.key),
          progress: num(row.progress),
          unlockedAt: row.unlocked_at != null ? num(row.unlocked_at) : null,
          updatedAt: Date.now(),
        });
      } else if (entity === "concept_progress") {
        const local = await db().concept_progress.get(String(row.conceptId));
        if (shouldApplyPulledConcept(local, row)) {
          await db().concept_progress.put(serverConceptToRow(row, userId));
        }
      } else if (entity === "question_history") {
        // Append-only and keyed by op_id: keep an existing local row as-is.
        const id = String(row.op_id);
        if (!(await db().question_history.get(id))) {
          await db().question_history.put(serverHistoryToRow(row));
        }
      } else if (entity === "daily_summary") {
        const key = String(row.dateKey);
        const local = await db().daily_summary.get(key);
        await db().daily_summary.put(mergeDailySummary(local, row));
      }
      // sessions_log / challenge_attempts / daily_streak / profiles are not
      // mirrored to Dexie (local is authoritative); their cursors still advance.
    } catch {
      // ignore: one bad row must not stop the page
    }
  }
}

/** Apply a sync_push canonical entry (best-effort). */
export async function applyCanonical(
  entity: string,
  row: Row | undefined,
  userId: string | null,
): Promise<void> {
  if (!row) return;
  try {
    if (entity === "country_progress") await applyCountry(row);
    else if (entity === "concept_progress") {
      // Same rule as the pull: a stale_review canonical can be older than the
      // local row (e.g. a resent op after a lost response while the user kept
      // answering), so never roll back a newer local review.
      const local = await db().concept_progress.get(String(row.conceptId));
      if (shouldApplyPulledConcept(local, row)) {
        await db().concept_progress.put(serverConceptToRow(row, userId));
      }
    }
  } catch {
    // ignore: canonical patches are best-effort
  }
}
