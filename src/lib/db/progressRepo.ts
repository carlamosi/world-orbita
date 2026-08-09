import { db } from "./orbita-db";
import type { ConceptProgressRow, QuestionHistoryRow } from "./orbita-db";
import { currentDbName } from "./dbProvider";

/** Extract Supabase user id from the active Dexie DB name (`orbita-${id}`). */
function activeUserId(): string | null {
  const name = currentDbName();
  if (name === "orbita-local") return null;
  return name.replace(/^orbita-/, "") || null;
}

/**
 * Retrieves a single concept's progress state from IndexedDB.
 */
export async function getConceptProgress(conceptId: string): Promise<ConceptProgressRow | undefined> {
  return await db().concept_progress.get(conceptId);
}

/**
 * Retrieves multiple concepts' progress states from IndexedDB.
 */
export async function getConceptsProgress(conceptIds: string[]): Promise<ConceptProgressRow[]> {
  const rows = await db().concept_progress.bulkGet(conceptIds);
  return rows.filter((r): r is ConceptProgressRow => r !== undefined);
}

/**
 * Atomically updates a concept's progress and logs the question history.
 * It also queues both records into the sync outbox for background syncing.
 */
export async function recordConceptAttempt(
  progressRow: ConceptProgressRow,
  historyRow: QuestionHistoryRow
): Promise<void> {
  await db().transaction("rw", db().concept_progress, db().question_history, db().outbox, async () => {
    const userId = activeUserId();
    const now = Date.now();
    // 1. Write the updated FSRS state
    progressRow.user_id = userId;
    progressRow.dirty = 1;
    progressRow.updated_at = now;
    await db().concept_progress.put(progressRow);
    
    // 2. Append to the immutable question history
    await db().question_history.put(historyRow);
    
    // 3. Build wire-safe payloads: strip Dexie-internal fields (dirty, user_id).
    //    The RPC enforces user scoping via auth.uid() server-side.
    const conceptPayload: Record<string, unknown> = {
      conceptId: progressRow.conceptId,
      iso3: progressRow.iso3,
      skill: progressRow.skill,
      fsrs_state: progressRow.fsrs_state,
      fsrs_stability: progressRow.fsrs_stability,
      fsrs_difficulty: progressRow.fsrs_difficulty,
      fsrs_due: progressRow.fsrs_due,
      fsrs_reps: progressRow.fsrs_reps,
      fsrs_lapses: progressRow.fsrs_lapses,
      fsrs_last_review: progressRow.fsrs_last_review,
      version: progressRow.version,
      updated_at: progressRow.updated_at,
    };
    const historyPayload: Record<string, unknown> = {
      op_id: historyRow.op_id,
      conceptId: historyRow.conceptId,
      sessionId: historyRow.sessionId,
      grade: historyRow.grade,
      responseMs: historyRow.responseMs,
      correct: historyRow.correct,
      answeredAt: historyRow.answeredAt,
    };

    // 4. Add to sync outbox
    await db().outbox.bulkAdd([
      {
        op_id: crypto.randomUUID(),
        entity: "concept_progress",
        op: "upsert",
        payload: conceptPayload,
        created_at: now,
        attempts: 0,
        next_attempt_at: 0,
        status: "pending",
      },
      {
        op_id: historyRow.op_id, // reuse the same op_id as the history row for idempotency
        entity: "question_history",
        op: "insert",
        payload: historyPayload,
        created_at: now,
        attempts: 0,
        next_attempt_at: 0,
        status: "pending",
      }
    ]);
  });
}
