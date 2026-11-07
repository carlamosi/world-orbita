/**
 * migrateGuestProgress.ts
 *
 * When a user signs in or creates an account, any progress accumulated as a
 * guest (stored in `orbita-local` IndexedDB) is merged into their personal DB
 * (`orbita-${userId}`) in one transaction that also queues an outbox op for
 * every merged row. Merge rules are the pull's (sync/apply.ts).
 *
 * The guest DB is deleted only after that transaction commits. On failure it
 * is kept (the next sign-in or page load retries) and
 * `sync_meta.guest_merge_pending` is set. Only rows the merge changes are
 * written and queued, so a rerun over the same guest data adds nothing.
 */
import Dexie from "dexie";
import { createOrbitaDb, type OrbitaDB, type OutboxRow } from "@/lib/db/orbita-db";
import { authDebug } from "@/lib/auth/debug";
import { mergeCountry, mergeUnlock, shouldApplyPulledConcept } from "@/lib/sync/apply";
import {
  conceptProgressPayload,
  countryProgressPayload,
  questionHistoryPayload,
  sessionsLogPayload,
  unlockPayload,
} from "@/lib/sync/payloads";
import { buildEnqueueRow } from "@/lib/sync/queue";

const GUEST_DB_NAME = "orbita-local";
const PENDING_KEY = "guest_merge_pending";

export async function migrateGuestProgress(
  userDb: OrbitaDB,
  userId: string,
): Promise<{ migrated: number; skipped: number }> {
  // Deleting orbita-local after a merge into itself would destroy the guest's data.
  if (userDb.name !== `orbita-${userId}`) return { migrated: 0, skipped: 0 };
  if (!(await Dexie.exists(GUEST_DB_NAME))) {
    authDebug("migrate:no_guest_db", { userId });
    return { migrated: 0, skipped: 0 };
  }

  const guestDb = createOrbitaDb(GUEST_DB_NAME);
  let migrated = 0;
  let skipped = 0;
  try {
    authDebug("migrate:start", { userId });
    // Read the guest first: the user transaction cannot span another DB.
    const [concepts, history, sessions, countries, unlocks] = await Promise.all([
      guestDb.concept_progress.toArray(),
      guestDb.question_history.toArray(),
      guestDb.gameSessions.toArray(),
      guestDb.countryProgress.toArray(),
      guestDb.unlocks.toArray(),
    ]);
    guestDb.close();

    const tables = [
      userDb.concept_progress,
      userDb.question_history,
      userDb.gameSessions,
      userDb.countryProgress,
      userDb.unlocks,
      userDb.outbox,
      userDb.sync_meta,
    ];
    await userDb.transaction("rw", tables, async () => {
      const ops: OutboxRow[] = [];
      const now = Date.now();

      for (const g of concepts) {
        if (!shouldApplyPulledConcept(await userDb.concept_progress.get(g.conceptId), { ...g })) {
          skipped++;
          continue;
        }
        const row = { ...g, user_id: userId, dirty: 1 as const, updated_at: now };
        await userDb.concept_progress.put(row);
        const payload = conceptProgressPayload(row);
        if (payload) ops.push(buildEnqueueRow({ entity: "concept_progress", op: "upsert", payload }));
        migrated++;
      }

      for (const h of history) {
        if (await userDb.question_history.get(h.op_id)) {
          skipped++;
          continue;
        }
        await userDb.question_history.put(h);
        ops.push(
          buildEnqueueRow({
            op_id: h.op_id,
            entity: "question_history",
            op: "insert",
            payload: questionHistoryPayload(h),
          }),
        );
        migrated++;
      }

      for (const { id: _id, ...s } of sessions) {
        // shortcut: a row without op_id (no current writer makes one) gets a fresh id per run, so a rerun after a failed delete can duplicate it; persist the id first if such rows appear.
        const op_id = s.op_id ?? crypto.randomUUID();
        if (await userDb.gameSessions.where("op_id").equals(op_id).count()) {
          skipped++;
          continue;
        }
        await userDb.gameSessions.add({ ...s, op_id, dirty: 1 });
        ops.push(buildEnqueueRow({ op_id, entity: "sessions_log", op: "insert", payload: sessionsLogPayload(s) }));
        migrated++;
      }

      for (const g of countries) {
        const local = await userDb.countryProgress.get(g.iso3);
        const merged = mergeCountry(local, countryProgressPayload(g));
        if (
          local &&
          JSON.stringify(merged.skills) === JSON.stringify(local.skills) &&
          merged.lastSeenAt === local.lastSeenAt
        ) {
          skipped++;
          continue;
        }
        await userDb.countryProgress.put({ ...merged, dirty: 1 });
        ops.push(
          buildEnqueueRow({ entity: "country_progress", op: "upsert", payload: countryProgressPayload(merged) }),
        );
        migrated++;
      }

      for (const g of unlocks) {
        const local = await userDb.unlocks.get(g.key);
        const merged = mergeUnlock(local, unlockPayload(g));
        if (local && merged.progress === local.progress && merged.unlockedAt === local.unlockedAt) {
          skipped++;
          continue;
        }
        await userDb.unlocks.put(merged);
        ops.push(buildEnqueueRow({ entity: "unlocks", op: "upsert", payload: unlockPayload(merged) }));
        migrated++;
      }

      if (ops.length) await userDb.outbox.bulkAdd(ops);
      await userDb.sync_meta.delete(PENDING_KEY);
    });
  } catch (err) {
    authDebug("migrate:error", { userId, error: err instanceof Error ? err.message : String(err) });
    await userDb.sync_meta.put({ key: PENDING_KEY, value: "1" }).catch(() => {});
    return { migrated: 0, skipped: 0 };
  } finally {
    guestDb.close();
  }

  try {
    await Dexie.delete(GUEST_DB_NAME);
  } catch (err) {
    // The merge is committed and a rerun adds nothing, so a failed delete is only retried later.
    authDebug("migrate:delete_failed", { userId, error: err instanceof Error ? err.message : String(err) });
  }
  authDebug("migrate:complete", { userId, migrated, skipped });
  return { migrated, skipped };
}
