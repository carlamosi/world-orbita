/**
 * Apply server rows (sync_pull pages and sync_push canonicals) to Dexie.
 *
 * Every apply is idempotent: the first pull page of a cycle deliberately
 * re-reads up to 15 s of rows (see cursor.ts), so applying the same row twice
 * must leave Dexie unchanged. All server dates are epoch ms numbers.
 */
import type {
  OrbitaDB,
  ConceptProgressRow,
  CountryProgressRow,
  DailySummaryRow,
  QuestionHistoryRow,
  UnlockRow,
} from "@/lib/db/orbita-db";
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

/**
 * Mirror of the server merge (sync_push country_progress): a pulled skill wins
 * only with a strictly higher version, so unpushed local skills survive.
 */
export function mergeCountry(local: CountryProgressRow | undefined, row: Row): CountryProgressRow {
  const pulled = (row.skills ?? {}) as Record<string, unknown>;
  const pulledVer = (row.skill_versions ?? {}) as Record<string, unknown>;
  const seen = row.last_seen_at != null ? num(row.last_seen_at, Date.now()) : Date.now();
  const skills: Record<string, unknown> = { ...(local?.skills ?? {}) };
  const versions: Record<string, number> = { ...(local?.skill_versions ?? {}) };
  for (const k of Object.keys(pulled)) {
    if (!(k in skills) || num(pulledVer[k]) > (versions[k] ?? 0)) {
      skills[k] = pulled[k];
      versions[k] = num(pulledVer[k]);
    }
  }
  const ahead = Object.keys(versions).some((k) => versions[k] > num(pulledVer[k]));
  return {
    iso3: String(row.country_code),
    skills: skills as never,
    skill_versions: versions as never,
    lastSeenAt: Math.max(local?.lastSeenAt ?? 0, seen),
    updated_at: Date.now(),
    dirty: ahead ? 1 : 0,
  };
}

/** Same merge as the server: progress only grows, the first unlock date stays. */
export function mergeUnlock(local: UnlockRow | undefined, row: Row): UnlockRow {
  const pulledAt = row.unlocked_at != null ? num(row.unlocked_at) : null;
  const at = [local?.unlockedAt ?? null, pulledAt].filter((v): v is number => v != null);
  return {
    key: String(row.key),
    progress: Math.max(local?.progress ?? 0, num(row.progress)),
    unlockedAt: at.length ? Math.min(...at) : null,
    updatedAt: Date.now(),
  };
}

async function applyCountry(d: OrbitaDB, row: Row) {
  await d.transaction("rw", d.countryProgress, async () => {
    const local = await d.countryProgress.get(String(row.country_code));
    await d.countryProgress.put(mergeCountry(local, row));
  });
}

/**
 * Concept apply shared by pull and canonical. A pending/in_flight op means an
 * unpushed local change: it reaches the server first, which answers with a
 * stale_review canonical if its row is newer, so skipping loses nothing. dirty
 * alone does not block: nothing clears it after a push (and seeded rows carry
 * it with no op), so it would block other devices' newer reviews forever.
 */
async function applyConcept(d: OrbitaDB, row: Row, userId: string | null) {
  const id = String(row.conceptId);
  await d.transaction("rw", d.concept_progress, d.outbox, async () => {
    const queued = await d.outbox
      .where("entity")
      .equals("concept_progress")
      .filter((r) => (r.status === "pending" || r.status === "in_flight") && r.payload?.conceptId === id)
      .count();
    if (queued > 0) return;
    if (shouldApplyPulledConcept(await d.concept_progress.get(id), row)) {
      await d.concept_progress.put(serverConceptToRow(row, userId));
    }
  });
}

/**
 * Apply one pull page for one entity. Errors propagate so the caller does not
 * advance the cursor past rows that were never written (SYNC-11).
 */
export async function applyPulledRows(
  d: OrbitaDB,
  entity: string,
  rows: Row[],
  userId: string | null,
): Promise<void> {
  for (const row of rows) {
    if (entity === "country_progress") {
      await applyCountry(d, row);
    } else if (entity === "unlocks") {
      await d.transaction("rw", d.unlocks, async () => {
        await d.unlocks.put(mergeUnlock(await d.unlocks.get(String(row.key)), row));
      });
    } else if (entity === "concept_progress") {
      await applyConcept(d, row, userId);
    } else if (entity === "question_history") {
      // Append-only and keyed by op_id: keep an existing local row as-is.
      const id = String(row.op_id);
      if (!(await d.question_history.get(id))) {
        await d.question_history.put(serverHistoryToRow(row));
      }
    } else if (entity === "daily_summary") {
      const key = String(row.dateKey);
      const local = await d.daily_summary.get(key);
      await d.daily_summary.put(mergeDailySummary(local, row));
    }
    // sessions_log / challenge_attempts / daily_streak / profiles are not
    // mirrored to Dexie (local is authoritative); their cursors still advance.
  }
}

/** Apply a sync_push canonical entry (best-effort). */
export async function applyCanonical(
  d: OrbitaDB,
  entity: string,
  row: Row | undefined,
  userId: string | null,
): Promise<void> {
  if (!row) return;
  try {
    if (entity === "country_progress") await applyCountry(d, row);
    else if (entity === "concept_progress") {
      // Same rule as the pull: a stale_review canonical can be older than the
      // local row (e.g. a resent op after a lost response while the user kept
      // answering), so never roll back a newer local review.
      await applyConcept(d, row, userId);
    }
  } catch {
    // ignore: canonical patches are best-effort
  }
}
