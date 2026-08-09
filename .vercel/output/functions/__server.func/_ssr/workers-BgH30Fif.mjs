import { d as db } from './orbita-db-Bdp3ClIj.mjs';
import { c as createSsrRpc } from './createSsrRpc-BPYX2guf.mjs';
import { a as createServerFn } from './index.mjs';
import { r as requireSupabaseAuth } from './auth-middleware-C5JPW8h7.mjs';
import { b as useSyncStore } from './router-T2jDQtma.mjs';
import '../_libs/dexie.mjs';
import '../_libs/seroval.mjs';
import '../_libs/react.mjs';
import '../_libs/sonner.mjs';
import { o as objectType, a as arrayType, n as numberType, r as recordType, s as stringType, u as unknownType, e as enumType } from '../_libs/zod.mjs';
import 'node:async_hooks';
import '../_libs/h3-v2.mjs';
import '../_libs/rou3.mjs';
import '../_libs/srvx.mjs';
import 'node:stream';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import '../_libs/tanstack__react-router.mjs';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
import '../_libs/clsx.mjs';
import '../_libs/tailwind-merge.mjs';
import './client-CnjuyyaV.mjs';
import '../_libs/radix-ui__react-dropdown-menu.mjs';
import '../_libs/radix-ui__primitive.mjs';
import '../_libs/radix-ui__react-compose-refs.mjs';
import '../_libs/radix-ui__react-context.mjs';
import '../_libs/@radix-ui/react-use-controllable-state+[...].mjs';
import '../_libs/@radix-ui/react-use-layout-effect+[...].mjs';
import '../_libs/radix-ui__react-primitive.mjs';
import '../_libs/radix-ui__react-slot.mjs';
import '../_libs/radix-ui__react-menu.mjs';
import '../_libs/radix-ui__react-collection.mjs';
import '../_libs/radix-ui__react-direction.mjs';
import '../_libs/@radix-ui/react-dismissable-layer+[...].mjs';
import '../_libs/@radix-ui/react-use-callback-ref+[...].mjs';
import '../_libs/@radix-ui/react-use-escape-keydown+[...].mjs';
import '../_libs/radix-ui__react-focus-guards.mjs';
import '../_libs/radix-ui__react-focus-scope.mjs';
import '../_libs/radix-ui__react-popper.mjs';
import '../_libs/floating-ui__react-dom.mjs';
import '../_libs/floating-ui__dom.mjs';
import '../_libs/floating-ui__core.mjs';
import '../_libs/floating-ui__utils.mjs';
import '../_libs/radix-ui__react-arrow.mjs';
import '../_libs/radix-ui__react-use-size.mjs';
import '../_libs/radix-ui__react-portal.mjs';
import '../_libs/radix-ui__react-presence.mjs';
import '../_libs/radix-ui__react-roving-focus.mjs';
import '../_libs/radix-ui__react-id.mjs';
import '../_libs/aria-hidden.mjs';
import '../_libs/react-remove-scroll.mjs';
import '../_libs/react-remove-scroll-bar.mjs';
import '../_libs/react-style-singleton.mjs';
import '../_libs/get-nonce.mjs';
import '../_libs/use-sidecar.mjs';
import '../_libs/use-callback-ref.mjs';
import '../_libs/framer-motion.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/zustand.mjs';

const MutationSchema = objectType({
  op_id: stringType().uuid(),
  entity: enumType(["sessions_log", "country_progress", "concept_progress", "question_history", "daily_summary", "challenge_attempts", "unlocks", "daily_streak", "profiles"]),
  op: enumType(["insert", "upsert"]),
  payload: recordType(stringType(), unknownType())
});
const PushSchema = objectType({
  mutations: arrayType(MutationSchema).max(100)
});
const _syncPush = createServerFn({
  method: "POST"
}).middleware([requireSupabaseAuth]).inputValidator((d) => PushSchema.parse(d)).handler(createSsrRpc("53c64cca3646c2b4aaf504a141a3d2042fd2449c1c0271acd3f45828b2e21f01"));
const PullSchema = objectType({
  cursors: recordType(stringType(), stringType().nullable()).default({}),
  limit: numberType().int().min(1).max(1e3).optional()
});
const _syncPull = createServerFn({
  method: "POST"
}).middleware([requireSupabaseAuth]).inputValidator((d) => PullSchema.parse(d)).handler(createSsrRpc("a47e3e26109e8d69cb5b2ed73ab22d2a9aaa221b5b9490a11286d7e99f779006"));
async function syncPush(args) {
  const json = await _syncPush({
    data: args.data
  });
  return JSON.parse(json);
}
async function syncPull(args) {
  const json = await _syncPull({
    data: args.data
  });
  return JSON.parse(json);
}

const MAX_ATTEMPTS = 10;
const BATCH = 50;
const PULL_INTERVAL_MS = 6e4;
const PUSH_INTERVAL_MS = 4e3;
let started = false;
let pushing = false;
let pulling = false;
function backoff(attempts) {
  const base = Math.min(6e4, 1e3 * 2 ** attempts);
  return Date.now() + base + Math.random() * 500;
}
async function refreshQueued() {
  try {
    const n = await db().outbox.where("status").notEqual("dead").count();
    useSyncStore.getState().setQueued(n);
  } catch {
  }
}
async function runPushOnce() {
  if (pushing) return;
  if (!useSyncStore.getState().signedIn) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useSyncStore.getState().setStatus("offline");
    return;
  }
  pushing = true;
  try {
    const now = Date.now();
    const due = await db().outbox.where("status").equals("pending").filter((r) => r.next_attempt_at <= now).limit(BATCH).toArray();
    if (due.length === 0) {
      await refreshQueued();
      const queued2 = useSyncStore.getState().queued;
      useSyncStore.getState().setStatus(queued2 > 0 ? "queued" : "synced");
      return;
    }
    useSyncStore.getState().setStatus("syncing");
    const ids = due.map((d) => d.id).filter((x) => x != null);
    await db().outbox.where("id").anyOf(ids).modify({ status: "in_flight" });
    const mutations = due.map((r) => ({
      op_id: r.op_id,
      entity: r.entity,
      op: r.op,
      payload: r.payload
    }));
    try {
      const result = await syncPush({ data: { mutations } });
      const acceptedSet = new Set(result.accepted);
      const rejectedMap = new Map(result.rejected.map((r) => [r.op_id, r.reason]));
      for (const r of due) {
        if (acceptedSet.has(r.op_id)) {
          await db().outbox.delete(r.id);
        } else if (rejectedMap.has(r.op_id)) {
          const reason = rejectedMap.get(r.op_id) ?? "rejected";
          const attempts = r.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await db().outbox.update(r.id, {
              status: "dead",
              last_error: reason,
              attempts
            });
          } else {
            await db().outbox.update(r.id, {
              status: "pending",
              attempts,
              next_attempt_at: backoff(attempts),
              last_error: reason
            });
          }
        } else {
          await db().outbox.update(r.id, { status: "pending" });
        }
      }
      for (const c of result.canonical) {
        if (c.entity === "country_progress") {
          const row = c.row;
          const iso3 = String(row.country_code);
          const skills = row.skills ?? {};
          const versions = row.skill_versions ?? {};
          try {
            const existing = await db().countryProgress.get(iso3);
            await db().countryProgress.put({
              iso3,
              skills,
              skill_versions: versions,
              lastSeenAt: existing?.lastSeenAt ?? Date.now(),
              updated_at: Date.now(),
              dirty: 0
            });
          } catch {
          }
        }
      }
      useSyncStore.getState().setLastPush(Date.now());
      useSyncStore.getState().setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "push failed";
      for (const r of due) {
        const attempts = r.attempts + 1;
        await db().outbox.update(r.id, {
          status: attempts >= MAX_ATTEMPTS ? "dead" : "pending",
          attempts,
          next_attempt_at: backoff(attempts),
          last_error: msg
        });
      }
      useSyncStore.getState().setError(msg);
      useSyncStore.getState().setStatus("error");
    }
    await refreshQueued();
    const queued = useSyncStore.getState().queued;
    if (useSyncStore.getState().status !== "error") {
      useSyncStore.getState().setStatus(queued > 0 ? "queued" : "synced");
    }
  } finally {
    pushing = false;
  }
}
const CURSOR_KEYS = [
  "country_progress",
  "concept_progress",
  "question_history",
  "daily_summary",
  "sessions_log",
  "unlocks",
  "challenge_attempts",
  "daily_streak",
  "profiles"
];
async function getCursors() {
  const out = {};
  for (const k of CURSOR_KEYS) {
    const row = await db().sync_meta.get(`cursor_${k}`);
    out[k] = row?.value ?? null;
  }
  return out;
}
async function runPullOnce() {
  if (pulling) return;
  if (!useSyncStore.getState().signedIn) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  pulling = true;
  try {
    const cursors = await getCursors();
    const result = await syncPull({ data: { cursors } });
    for (const [entity, payload] of Object.entries(result)) {
      if (!payload) continue;
      const rows = payload.rows ?? [];
      if (entity === "country_progress") {
        for (const r of rows) {
          const row = r;
          const iso3 = String(row.country_code);
          await db().countryProgress.put({
            iso3,
            skills: row.skills ?? {},
            skill_versions: row.skill_versions ?? {},
            lastSeenAt: row.last_seen_at ? Date.parse(String(row.last_seen_at)) : Date.now(),
            updated_at: Date.now(),
            dirty: 0
          }).catch(() => {
          });
        }
      } else if (entity === "unlocks") {
        for (const r of rows) {
          const row = r;
          await db().unlocks.put({
            key: String(row.key),
            progress: Number(row.progress ?? 0),
            unlockedAt: row.unlocked_at ? Date.parse(String(row.unlocked_at)) : null,
            updatedAt: Date.now()
          }).catch(() => {
          });
        }
      }
      await db().sync_meta.put({ key: `cursor_${entity}`, value: payload.cursor }).catch(() => {
      });
    }
    useSyncStore.getState().setLastPull(Date.now());
    useSyncStore.getState().setError(null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pull failed";
    useSyncStore.getState().setError(msg);
  } finally {
    pulling = false;
  }
}
function startSyncWorkers() {
  if (started) return;
  started = true;
  setInterval(() => void runPushOnce(), PUSH_INTERVAL_MS);
  setInterval(() => void runPullOnce(), PULL_INTERVAL_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }
  void runPullOnce();
  void runPushOnce();
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
function forceSync() {
  void runPullOnce();
  void runPushOnce();
}
async function forceFullResync() {
  try {
    for (const k of CURSOR_KEYS) {
      await db().sync_meta.delete(`cursor_${k}`).catch(() => {
      });
    }
  } catch {
  }
  void runPullOnce();
  void runPushOnce();
}
async function handleSignedInSync(userDb, userId) {
  const { migrateGuestProgress } = await import('./migrateGuestProgress-CU2yiHQ1.mjs');
  const result = await migrateGuestProgress(userDb, userId);
  if (result.migrated > 0) {
    await runPushOnce();
  }
  return result;
}

export { forceFullResync, forceSync, handleSignedInSync, refreshQueued, runPushOnce, startSyncWorkers };
