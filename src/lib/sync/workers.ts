/**
 * Push + pull workers. Both run on intervals and listen to visibility.
 * They are explicitly fire-and-forget — failures never propagate to gameplay.
 */
import { db } from "@/lib/db/orbita-db";
import { currentDbName } from "@/lib/db/dbProvider";
import { syncPush, syncPull } from "./sync.functions";
import { useSyncStore } from "./useSyncStore";
import { PERMANENT_REJECT_REASONS, type Mutation, type SyncEntity } from "./types";
import type { OutboxRow } from "@/lib/db/orbita-db";
import { isValidOpId } from "./opId";
import { applyCanonical, applyPulledRows } from "./apply";
import { cursorToStore, overlapCursor } from "./cursor";

/** Derive the Supabase user_id from the active Dexie DB name. Returns null for guest DB. */
function activeUserId(): string | null {
  const name = currentDbName();
  if (name === "orbita-local") return null;
  return name.replace(/^orbita-/, "") || null;
}

const MAX_ATTEMPTS = 10;
const BATCH = 50;
const PULL_INTERVAL_MS = 60_000;
const PUSH_INTERVAL_MS = 4_000;

let pushTimer: ReturnType<typeof setInterval> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let pushing = false;
let pulling = false;

function backoff(attempts: number): number {
  const base = Math.min(60_000, 1_000 * 2 ** attempts);
  return Date.now() + base + Math.random() * 500;
}

async function refreshQueued() {
  try {
    // Count only "pending" items — in_flight are mid-push (not stuck), dead are exhausted.
    const n = await db().outbox.where("status").equals("pending").count();
    useSyncStore.getState().setQueued(n);
  } catch {
    // ignore
  }
}

/**
 * On startup, reset any `in_flight` items back to `pending`.
 * These are items that were mid-push when the app was closed or crashed.
 * Without this, they remain stuck forever since runPushOnce only picks up `pending` items.
 */
async function recoverInFlight() {
  try {
    await db()
      .outbox.where("status")
      .equals("in_flight")
      .modify({ status: "pending", next_attempt_at: 0 } as Partial<import("../db/orbita-db").OutboxRow>);
  } catch {
    // ignore — non-critical
  }
}

/**
 * Mark outbox items whose op_id is not a UUID as dead. sync_push rejects them
 * with invalid_op_id, so they can never succeed (old builds appended ":cp").
 * They stay visible as dead letters instead of being silently dropped.
 */
async function purgeBrokenOpIds() {
  try {
    await db()
      .outbox.filter((r) => r.status !== "dead" && !isValidOpId(r.op_id))
      .modify({ status: "dead", last_error: "invalid_op_id" } as Partial<OutboxRow>);
  } catch {
    // ignore — non-critical
  }
}

/** A user_id foreign-key failure means auth.users no longer has this user. */
function isOrphanedSessionError(msg: string): boolean {
  return /violates foreign key constraint/i.test(msg) && /_user_id_fkey|auth\.users/i.test(msg);
}

/** The server-function auth middleware rejected the token (e.g. deleted user). */
function isAuthRejection(e: unknown): boolean {
  const status = (e as { statusCode?: number; status?: number } | null)?.statusCode ??
    (e as { status?: number } | null)?.status;
  const msg = e instanceof Error ? e.message : "";
  return status === 401 || /unauthorized/i.test(msg);
}

let signingOut = false;
let checkingSession = false;

/**
 * Auth failure: never spend attempts. Ask GoTrue once whether the session is
 * still valid; sign out only on a definitive answer (session missing, 401/403/404,
 * or no user and no error). If it is valid, or the check itself failed
 * transiently (network, 5xx, 429), keep the session: just back off and retry.
 */
async function handleAuthRejection(due: OutboxRow[], msg: string) {
  await db()
    .outbox.where("id")
    .anyOf(due.map((d) => d.id!))
    .modify({ status: "pending", next_attempt_at: backoff(3) } as Partial<OutboxRow>);
  useSyncStore.getState().setError(msg);
  await verifySessionOrSignOut();
}

async function verifySessionOrSignOut() {
  if (checkingSession || signingOut) return;
  checkingSession = true;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    let gone = false;
    try {
      const { data, error } = await supabase.auth.getUser();
      // Classified by name/status (not instanceof): only definitive answers sign out.
      // Network, 5xx, 429 or a missing status are unknown, so keep the session.
      const e = error as { name?: string; status?: number } | null;
      gone = e
        ? e.name === "AuthSessionMissingError" || [401, 403, 404].includes(e.status as number)
        : !data?.user;
    } catch {
      gone = false; // getUser threw (e.g. offline): unknown, retry next cycle
    }
    if (!gone) return;
    signingOut = true;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[sync] signOut after auth rejection failed:", err);
    } finally {
      signingOut = false;
    }
  } catch (err) {
    console.warn("[sync] session check failed:", err);
  } finally {
    checkingSession = false;
  }
}

/**
 * The account was deleted (e.g. by the v2 reset) but this browser still holds
 * its JWT. Retrying only burns attempts: keep every row pending, sign out once.
 */
async function handleOrphanedSession(due: OutboxRow[], msg: string) {
  await db()
    .outbox.where("id")
    .anyOf(due.map((d) => d.id!))
    .modify({ status: "pending" });
  useSyncStore.getState().setError(msg);
  if (signingOut) return;
  signingOut = true;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[sync] signOut after orphaned session failed:", err);
  } finally {
    signingOut = false;
  }
}

async function markRetry(r: OutboxRow, reason: string) {
  const attempts = r.attempts + 1;
  await db().outbox.update(r.id!, {
    status: attempts >= MAX_ATTEMPTS ? "dead" : "pending",
    attempts,
    next_attempt_at: backoff(attempts),
    last_error: reason,
  } as Partial<OutboxRow>);
}

async function pushBatch(due: OutboxRow[]) {
  const ids = due.map((d) => d.id!).filter((x) => x != null);
  await db().outbox.where("id").anyOf(ids).modify({ status: "in_flight" });
  const mutations: Mutation[] = due.map((r) => ({
    op_id: r.op_id,
    entity: r.entity,
    op: r.op,
    payload: r.payload,
  }));
  try {
    const result = await syncPush({ data: { mutations } });
    const accepted = Array.isArray(result?.accepted) ? result.accepted : [];
    const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
    const canonical = Array.isArray(result?.canonical) ? result.canonical : [];
    const orphaned = rejected.find((r) => isOrphanedSessionError(String(r.reason)));
    if (orphaned) {
      // sync_push reports the FK failure per item instead of raising.
      await handleOrphanedSession(due, String(orphaned.reason));
      return;
    }
    const acceptedSet = new Set(accepted);
    const rejectedMap = new Map(rejected.map((r) => [r.op_id, String(r.reason)]));
    for (const r of due) {
      if (acceptedSet.has(r.op_id)) {
        await db().outbox.delete(r.id!);
      } else if (rejectedMap.has(r.op_id)) {
        const reason = rejectedMap.get(r.op_id)!;
        if (PERMANENT_REJECT_REASONS.includes(reason)) {
          // Permanent: retrying the same payload can never succeed.
          await db().outbox.update(r.id!, {
            status: "dead",
            attempts: r.attempts + 1,
            last_error: reason,
          } as Partial<OutboxRow>);
        } else if (reason === "stale_review") {
          // The server kept a newer review; its canonical row is applied below.
          await db().outbox.delete(r.id!);
        } else {
          await markRetry(r, reason);
        }
      } else {
        await db().outbox.update(r.id!, { status: "pending" } as Partial<OutboxRow>);
      }
    }
    // Canonical rows: country_progress after every accept, concept_progress on stale_review.
    const uid = activeUserId();
    for (const c of canonical) {
      await applyCanonical(String(c.entity), c.payload, uid);
    }
    useSyncStore.getState().setLastPush(Date.now());
    useSyncStore.getState().setError(null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "push failed";
    if (isAuthRejection(e)) {
      await handleAuthRejection(due, msg);
      return;
    }
    if (isOrphanedSessionError(msg)) {
      await handleOrphanedSession(due, msg);
      return;
    }
    for (const r of due) await markRetry(r, msg);
    useSyncStore.getState().setError(msg);
    useSyncStore.getState().setStatus("error");
  }
}

export async function runPushOnce() {
  if (pushing) return;
  if (!useSyncStore.getState().signedIn) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useSyncStore.getState().setStatus("offline");
    return;
  }
  pushing = true;
  try {
    const now = Date.now();
    const due = await db()
      .outbox.where("status")
      .equals("pending")
      .filter((r) => r.next_attempt_at <= now)
      .limit(BATCH)
      .toArray();
    if (due.length === 0) {
      await refreshQueued();
      const queued = useSyncStore.getState().queued;
      useSyncStore.getState().setStatus(queued > 0 ? "queued" : "synced");
      return;
    }
    useSyncStore.getState().setStatus("syncing");
    // Ruling 6d: a non-UUID op_id can never succeed; mark it dead locally and
    // never send it, so it cannot fail the server-side validation of the batch.
    const sendable: OutboxRow[] = [];
    for (const r of due) {
      if (isValidOpId(r.op_id)) sendable.push(r);
      else {
        await db().outbox.update(r.id!, {
          status: "dead",
          attempts: r.attempts + 1,
          last_error: "invalid_op_id",
        } as Partial<OutboxRow>);
      }
    }
    if (sendable.length > 0) await pushBatch(sendable);
    await refreshQueued();
    const queued = useSyncStore.getState().queued;
    if (useSyncStore.getState().status !== "error") {
      useSyncStore.getState().setStatus(queued > 0 ? "queued" : "synced");
    }
  } finally {
    pushing = false;
  }
}

const CURSOR_KEYS: SyncEntity[] = [
  "country_progress",
  "concept_progress",
  "question_history",
  "daily_summary",
  "sessions_log",
  "unlocks",
  "challenge_attempts",
  "daily_streak",
  "profiles",
];

async function getCursors(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of CURSOR_KEYS) {
    const row = await db().sync_meta.get(`cursor_${k}`);
    out[k] = row?.value ?? null;
  }
  return out;
}

/** Safety cap on has_more pages within one pull cycle. */
export const MAX_PULL_PAGES = 20;

/**
 * One pull cycle. Page 1 sends every stored cursor moved back by the overlap
 * (cursor.ts); while any entity reports has_more, the next page sends the
 * server cursors exactly as returned. Stored cursors never move backwards.
 */
export async function runPullOnce(opts: { limit?: number } = {}) {
  if (pulling) return;
  if (!useSyncStore.getState().signedIn) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  pulling = true;
  try {
    const stored = await getCursors();
    const uid = activeUserId();
    let send: Record<string, string | null> = {};
    for (const k of CURSOR_KEYS) send[k] = overlapCursor(stored[k] ?? null);
    for (let pageNo = 0; pageNo < MAX_PULL_PAGES; pageNo++) {
      const result = await syncPull({ data: { cursors: send, limit: opts.limit } });
      const next: Record<string, string | null> = { ...send };
      let more = false;
      for (const [entity, payload] of Object.entries(result ?? {})) {
        if (!payload) continue;
        await applyPulledRows(entity, payload.rows ?? [], uid);
        const server = payload.cursor ?? null;
        next[entity] = server ?? send[entity] ?? null;
        const keep = cursorToStore(stored[entity] ?? null, server);
        if (keep !== (stored[entity] ?? null)) {
          stored[entity] = keep;
          await db()
            .sync_meta.put({ key: `cursor_${entity}`, value: keep as string })
            .catch(() => {});
        }
        if (payload.has_more === true) more = true;
      }
      if (!more) break;
      send = next;
    }
    useSyncStore.getState().setLastPull(Date.now());
    useSyncStore.getState().setError(null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pull failed";
    useSyncStore.getState().setError(msg);
    if (isAuthRejection(e)) await verifySessionOrSignOut();
  } finally {
    pulling = false;
  }
}

export function startSyncWorkers() {
  if (started) return;
  started = true;
  pushTimer = setInterval(() => void runPushOnce(), PUSH_INTERVAL_MS);
  pullTimer = setInterval(() => void runPullOnce(), PULL_INTERVAL_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }
  // On startup: purge permanently-broken op_ids, reset in_flight items,
  // then run first push/pull cycle.
  Promise.all([purgeBrokenOpIds(), recoverInFlight()]).then(() => {
    void runPullOnce();
    void runPushOnce();
  });
}

export function stopSyncWorkers() {
  started = false;
  if (pushTimer) clearInterval(pushTimer);
  if (pullTimer) clearInterval(pullTimer);
  pushTimer = null;
  pullTimer = null;
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  }
}

function onVisibility() {
  if (document.visibilityState === "visible") {
    void runPullOnce();
    void runPushOnce();
  }
}
function onOnline() {
  void runPushOnce();
  void runPullOnce();
}
function onOffline() {
  useSyncStore.getState().setStatus("offline");
}

export async function forceSync() {
  // Reset backoff on all pending items so they are immediately eligible.
  try {
    await db()
      .outbox.where("status")
      .equals("pending")
      .modify({ next_attempt_at: 0 } as Partial<import("../db/orbita-db").OutboxRow>);
  } catch {
    // ignore
  }
  void runPullOnce();
  void runPushOnce();
}

/** Clear all pull cursors then trigger a fresh full pull. */
export async function forceFullResync() {
  try {
    for (const k of CURSOR_KEYS) {
      await db().sync_meta.delete(`cursor_${k}`).catch(() => {});
    }
  } catch {
    // ignore
  }
  void runPullOnce();
  void runPushOnce();
}

/** Clear all dead-letter outbox items (exhausted retries). */
export async function clearDeadLetter() {
  try {
    await db().outbox.where("status").equals("dead").delete();
    await refreshQueued();
  } catch {
    // ignore
  }
}

export { refreshQueued };

/**
 * Called on SIGNED_IN — merges guest IndexedDB into the user DB and
 * immediately pushes dirty rows to Supabase.
 */
export async function handleSignedInSync(
  userDb: import("@/lib/db/orbita-db").OrbitaDB,
  userId: string,
): Promise<{ migrated: number; skipped: number }> {
  const { migrateGuestProgress } = await import("@/lib/auth/migrateGuestProgress");
  const result = await migrateGuestProgress(userDb, userId);
  if (result.migrated > 0) {
    await runPushOnce();
  }
  return result;
}
