/**
 * Push + pull workers. Both run on intervals and listen to visibility.
 * They are explicitly fire-and-forget — failures never propagate to gameplay.
 */
import { db, type OrbitaDB } from "@/lib/db/orbita-db";
import { currentDbName, onSwap, trackCycle } from "@/lib/db/dbProvider";
import { syncPush, syncPull } from "./sync.functions";
import { useSyncStore } from "./useSyncStore";
import { PERMANENT_REJECT_REASONS, type Mutation, type SyncEntity } from "./types";
import type { OutboxRow } from "@/lib/db/orbita-db";
import { isValidOpId } from "./opId";
import { applyCanonical, applyPulledRows } from "./apply";
import { cursorToStore, overlapCursor } from "./cursor";

/** Derive the Supabase user_id from a Dexie DB name. Returns null for guest DB. */
function activeUserId(name: string): string | null {
  if (name === "orbita-local") return null;
  return name.replace(/^orbita-/, "") || null;
}

/** A cycle stops writing once the provider has moved to another DB. */
const moved = (name: string) => currentDbName() !== name;

const MAX_ATTEMPTS = 10;
const BATCH = 50;
/** An in_flight row pushed longer ago than this is treated as pending again. */
const LEASE_MS = 60_000;
const PULL_INTERVAL_MS = 60_000;
const PUSH_INTERVAL_MS = 4_000;

let pushTimer: ReturnType<typeof setInterval> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let offSwap: (() => void) | null = null;
/** DBs recovered in full this page session; a re-activated one may have a live cycle. */
const recovered = new Set<string>();
let started = false;
let pushing = false;
let pulling = false;

/** Consecutive transient push failures; drives backoff without spending attempts. */
let transientStreak = 0;

function backoff(attempts: number, cap = 60_000): number {
  const base = Math.min(cap, 1_000 * 2 ** attempts);
  return Date.now() + base + Math.random() * 500;
}

async function refreshQueued() {
  try {
    // Count only "pending" items — in_flight are mid-push (not stuck), dead are exhausted.
    const n = await db().outbox.where("status").equals("pending").count();
    useSyncStore.getState().setQueued(n);
    useSyncStore.getState().setDead(await db().outbox.where("status").equals("dead").count());
  } catch {
    // ignore
  }
}

/**
 * Reset `in_flight` rows back to `pending`: they were mid-push when the app
 * closed, crashed, or a timed-out swap closed their DB. Only runPushOnce picks
 * up `pending`, so they would stay stuck. `all` (startup, before any cycle) resets
 * every one; otherwise only stale leases, as a live cycle may still own a fresh one.
 */
async function recoverInFlight(d: OrbitaDB, all: boolean) {
  try {
    const cutoff = Date.now() - LEASE_MS;
    await d.outbox
      .where("status")
      .equals("in_flight")
      .filter((r) => all || r.next_attempt_at < cutoff)
      .modify({ status: "pending", next_attempt_at: 0 } as Partial<OutboxRow>);
  } catch {
    // ignore — non-critical
  }
}

/**
 * Mark outbox items whose op_id is not a UUID as dead. sync_push rejects them
 * with invalid_op_id, so they can never succeed (old builds appended ":cp").
 * They stay visible as dead letters instead of being silently dropped.
 */
async function purgeBrokenOpIds(d: OrbitaDB) {
  try {
    await d.outbox
      .filter((r) => r.status !== "dead" && !isValidOpId(r.op_id))
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
async function handleAuthRejection(d: OrbitaDB, due: OutboxRow[], msg: string) {
  await d.outbox
    .where("op_id")
    .anyOf(due.map((r) => r.op_id))
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
async function handleOrphanedSession(d: OrbitaDB, due: OutboxRow[], msg: string) {
  await d.outbox
    .where("op_id")
    .anyOf(due.map((r) => r.op_id))
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

async function markRetry(d: OrbitaDB, r: OutboxRow, reason: string) {
  const attempts = r.attempts + 1;
  await d.outbox
    .where("op_id")
    .equals(r.op_id)
    .modify({
      status: attempts >= MAX_ATTEMPTS ? "dead" : "pending",
      attempts,
      next_attempt_at: backoff(attempts),
      last_error: reason,
    } as Partial<OutboxRow>);
}

/** Transport/5xx failure: never spends attempts or dead-letters, only backs off (max 5 min). */
async function markTransient(d: OrbitaDB, due: OutboxRow[], reason: string) {
  const next = backoff(transientStreak++, 300_000);
  await d.outbox
    .where("op_id")
    .anyOf(due.map((r) => r.op_id))
    .modify({ status: "pending", next_attempt_at: next, last_error: reason } as Partial<OutboxRow>);
}

async function pushBatch(d: OrbitaDB, name: string, due: OutboxRow[]) {
  await d.outbox
    .where("op_id")
    .anyOf(due.map((r) => r.op_id))
    .modify({ status: "in_flight", next_attempt_at: Date.now() } as Partial<OutboxRow>); // lease start
  if (moved(name)) return;
  const mutations: Mutation[] = due.map((r) => ({
    op_id: r.op_id,
    entity: r.entity,
    op: r.op,
    payload: r.payload,
  }));
  try {
    const result = await syncPush({ data: { mutations } });
    if (moved(name)) return;
    const accepted = Array.isArray(result?.accepted) ? result.accepted : [];
    const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
    const canonical = Array.isArray(result?.canonical) ? result.canonical : [];
    const orphaned = rejected.find((r) => isOrphanedSessionError(String(r.reason)));
    if (orphaned) {
      // sync_push reports the FK failure per item instead of raising.
      await handleOrphanedSession(d, due, String(orphaned.reason));
      return;
    }
    const acceptedSet = new Set(accepted);
    const rejectedMap = new Map(rejected.map((r) => [r.op_id, String(r.reason)]));
    for (const r of due) {
      if (moved(name)) return;
      const row = d.outbox.where("op_id").equals(r.op_id);
      if (acceptedSet.has(r.op_id)) {
        await row.delete();
      } else if (rejectedMap.has(r.op_id)) {
        const reason = rejectedMap.get(r.op_id)!;
        if (PERMANENT_REJECT_REASONS.includes(reason)) {
          // Permanent: retrying the same payload can never succeed.
          await row.modify({
            status: "dead",
            attempts: r.attempts + 1,
            last_error: reason,
          } as Partial<OutboxRow>);
        } else if (reason === "stale_review") {
          // The server kept a newer review; its canonical row is applied below.
          await row.delete();
        } else {
          await markRetry(d, r, reason);
        }
      } else {
        await row.modify({ status: "pending" } as Partial<OutboxRow>);
      }
    }
    // Canonical rows: country_progress after every accept, concept_progress on stale_review.
    const uid = activeUserId(name);
    for (const c of canonical) {
      if (moved(name)) return;
      await applyCanonical(d, String(c.entity), c.payload, uid);
    }
    transientStreak = 0;
    useSyncStore.getState().setLastPush(Date.now());
    useSyncStore.getState().setError(null);
  } catch (e) {
    if (moved(name)) return;
    const msg = e instanceof Error ? e.message : "push failed";
    if (isAuthRejection(e)) {
      await handleAuthRejection(d, due, msg);
      return;
    }
    if (isOrphanedSessionError(msg)) {
      await handleOrphanedSession(d, due, msg);
      return;
    }
    await markTransient(d, due, msg);
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
    await trackCycle(pushCycle());
  } finally {
    pushing = false;
  }
}

/** Bound to the DB current when it starts; registered with swap() via trackCycle. */
async function pushCycle() {
  const d = db();
  const name = currentDbName();
  const now = Date.now();
  const due = await d.outbox
    .where("status")
    .anyOf("pending", "in_flight")
    .filter((r) =>
      r.status === "pending" ? r.next_attempt_at <= now : r.next_attempt_at < now - LEASE_MS,
    )
    .limit(BATCH)
    .toArray();
  if (moved(name)) return;
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
      if (moved(name)) return;
      await d.outbox
        .where("op_id")
        .equals(r.op_id)
        .modify({
          status: "dead",
          attempts: r.attempts + 1,
          last_error: "invalid_op_id",
        } as Partial<OutboxRow>);
    }
  }
  if (sendable.length > 0) await pushBatch(d, name, sendable);
  if (moved(name)) return;
  await refreshQueued();
  const queued = useSyncStore.getState().queued;
  if (useSyncStore.getState().status !== "error") {
    useSyncStore.getState().setStatus(queued > 0 ? "queued" : "synced");
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

async function getCursors(d: OrbitaDB): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of CURSOR_KEYS) {
    const row = await d.sync_meta.get(`cursor_${k}`);
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
    await trackCycle(pullCycle(opts));
  } finally {
    pulling = false;
  }
}

/** Bound to the DB current when it starts; registered with swap() via trackCycle. */
async function pullCycle(opts: { limit?: number }) {
  const d = db();
  const name = currentDbName();
  try {
    const stored = await getCursors(d);
    if (moved(name)) return;
    const uid = activeUserId(name);
    let send: Record<string, string | null> = {};
    for (const k of CURSOR_KEYS) send[k] = overlapCursor(stored[k] ?? null);
    for (let pageNo = 0; pageNo < MAX_PULL_PAGES; pageNo++) {
      const result = await syncPull({ data: { cursors: send, limit: opts.limit } });
      if (moved(name)) return;
      const next: Record<string, string | null> = { ...send };
      let more = false;
      for (const [entity, payload] of Object.entries(result ?? {})) {
        if (!payload) continue;
        if (moved(name)) return;
        await applyPulledRows(d, entity, payload.rows ?? [], uid);
        if (moved(name)) return;
        const server = payload.cursor ?? null;
        next[entity] = server ?? send[entity] ?? null;
        const keep = cursorToStore(stored[entity] ?? null, server);
        if (keep !== (stored[entity] ?? null)) {
          stored[entity] = keep;
          await d.sync_meta.put({ key: `cursor_${entity}`, value: keep as string });
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
  // A DB's first activation has had no cycle bound to it, so every in_flight
  // row is orphaned; a re-activated one gets lease-only recovery.
  offSwap = onSwap((d) => {
    const first = !recovered.has(d.name);
    recovered.add(d.name);
    void Promise.all([purgeBrokenOpIds(d), recoverInFlight(d, first)]);
  });
  const d = db();
  recovered.add(d.name);
  Promise.all([purgeBrokenOpIds(d), recoverInFlight(d, true)]).then(() => {
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
  offSwap?.();
  offSwap = null;
  recovered.clear();
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  }
}

function onVisibility() {
  if (document.visibilityState === "visible") void forceSync();
}
function onOnline() {
  void forceSync();
}
function onOffline() {
  useSyncStore.getState().setStatus("offline");
}

export async function forceSync() {
  // Reset backoff on all pending items so they are immediately eligible.
  transientStreak = 0;
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

/** Dead rows back to pending, attempts 0, due now. */
export async function retryFailed() {
  try {
    await db()
      .outbox.where("status")
      .equals("dead")
      .modify({ status: "pending", attempts: 0, next_attempt_at: 0 } as Partial<OutboxRow>);
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
