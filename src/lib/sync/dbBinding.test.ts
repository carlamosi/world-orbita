// @vitest-environment jsdom
// A sync cycle belongs to the Dexie DB it started on, and outbox rows are
// addressed by op_id (outbox ids are per-DB autoincrements and can collide).
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrbitaDb, type OutboxRow } from "@/lib/db/orbita-db";
import { swap, currentDbName, getCurrent, onSwap, SWAP_WAIT_MS } from "@/lib/db/dbProvider";
import type { Mutation, PullResult, PushResult } from "./types";

let pushReply: (m: Mutation[]) => Promise<PushResult>;
let pullReply: () => Promise<PullResult> = async () => ({}) as PullResult;
vi.mock("./sync.functions", () => ({
  syncPull: vi.fn(async () => pullReply()),
  syncPush: vi.fn(async (a: { data: { mutations: Mutation[] } }) => pushReply(a.data.mutations)),
}));
const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: { id: "u" } }, error: null })));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser, signOut: vi.fn(async () => ({ error: null })) } },
}));

import { runPullOnce, runPushOnce } from "./workers";
import { useSyncStore } from "./useSyncStore";

const T = Date.UTC(2026, 10, 6, 10, 0, 0);
function outbox(op_id: string): OutboxRow {
  return {
    op_id,
    entity: "country_progress",
    op: "upsert",
    payload: { a: 1 },
    created_at: T,
    attempts: 0,
    next_attempt_at: 0,
    status: "pending",
  };
}

beforeEach(async () => {
  await swap(crypto.randomUUID());
  useSyncStore.setState({ signedIn: true, status: "idle", lastError: null });
});

describe("db binding", () => {
  it("cycle aborts when db swapped", async () => {
    const a = createOrbitaDb(currentDbName()); // same IndexedDB as the provider's
    const op = crypto.randomUUID();
    await a.outbox.add(outbox(op));
    // User B's DB already holds an outbox row with the same autoincrement id.
    const uidB = crypto.randomUUID();
    const pre = createOrbitaDb(`orbita-${uidB}`);
    const theirs = outbox(crypto.randomUUID());
    await pre.outbox.add(theirs);
    pre.close();

    let release!: () => void;
    let sent!: () => void;
    const reached = new Promise<void>((r) => (sent = r));
    pushReply = (m) => {
      sent();
      return new Promise((r) => {
        release = () =>
          r({
            accepted: m.map((x) => x.op_id),
            rejected: [],
            canonical: [
              {
                entity: "country_progress",
                op_id: op,
                payload: { country_code: "FRA", skills: {}, skill_versions: {}, last_seen_at: T },
              },
            ],
          });
      });
    };
    const push = runPushOnce();
    await reached;
    const swapped = swap(uidB);
    release();
    const b = await swapped;
    await push;

    expect(currentDbName()).toBe(`orbita-${uidB}`);
    expect(await b.outbox.toArray()).toMatchObject([{ ...theirs, status: "pending" }]);
    expect(await b.countryProgress.count()).toBe(0);
    // swap() waited, so the cycle finished on its own DB.
    expect(await a.outbox.count()).toBe(0);
    expect(await a.countryProgress.get("FRA")).toBeDefined();
    a.close();
  });

  it("a hung cycle cannot block swap: it is aborted instead", async () => {
    const a = createOrbitaDb(currentDbName());
    await a.outbox.add(outbox(crypto.randomUUID()));
    const uidB = crypto.randomUUID();
    const pre = createOrbitaDb(`orbita-${uidB}`);
    const theirs = outbox(crypto.randomUUID());
    await pre.outbox.add(theirs);
    pre.close();

    let release!: (r: PushResult) => void;
    let sent!: () => void;
    const reached = new Promise<void>((r) => (sent = r));
    pushReply = (m) => {
      sent();
      return new Promise((r) => {
        release = () =>
          r({
            accepted: m.map((x) => x.op_id),
            rejected: [],
            canonical: [
              {
                entity: "country_progress",
                op_id: m[0].op_id,
                payload: { country_code: "FRA", skills: {}, skill_versions: {}, last_seen_at: T },
              },
            ],
          });
      });
    };
    const push = runPushOnce();
    await reached;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const swapped = swap(uidB);
      await vi.advanceTimersByTimeAsync(SWAP_WAIT_MS);
      const b = await swapped;
      expect(currentDbName()).toBe(`orbita-${uidB}`);
      release({ accepted: [], rejected: [], canonical: [] });
      await push;
      expect(await b.outbox.toArray()).toMatchObject([{ ...theirs, status: "pending" }]);
      expect(await b.countryProgress.count()).toBe(0);
      // The cycle stopped after the switch: its row stays in_flight in A.
      expect(await a.outbox.toArray()).toMatchObject([{ status: "in_flight" }]);
    } finally {
      vi.useRealTimers();
      a.close();
    }
  });

  // Switch the provider to B while the cycle is applying a large reply to A:
  // fire the swap timeout once the first row has landed in A.
  async function switchMidApply(rowsInA: () => Promise<number>, release: () => void) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const uidB = crypto.randomUUID();
      const swapped = swap(uidB);
      await vi.advanceTimersByTimeAsync(SWAP_WAIT_MS - 1);
      release();
      while ((await rowsInA()) === 0) await new Promise((r) => setImmediate(r));
      await vi.advanceTimersByTimeAsync(1);
      return await swapped;
    } finally {
      vi.useRealTimers();
    }
  }

  it("a timed-out pull's late rows stay out of the new DB", async () => {
    const a = createOrbitaDb(currentDbName());
    const rows = Array.from({ length: 300 }, (_, i) => ({
      key: `k${i}`,
      progress: 1,
      unlocked_at: T,
      updated_at: T,
    }));
    let release!: () => void;
    const reached = new Promise<void>((sent) => {
      pullReply = () => {
        sent();
        return new Promise((r) => {
          release = () => r({ unlocks: { rows, cursor: `${T}|k`, has_more: false } } as PullResult);
        });
      };
    });
    const pull = runPullOnce();
    await reached;
    const b = await switchMidApply(
      () => a.unlocks.count(),
      () => release(),
    );
    await pull;
    expect(await b.unlocks.count()).toBe(0);
    expect(await b.sync_meta.count()).toBe(0);
    a.close();
  });

  it("a timed-out push's late canonical rows stay out of the new DB", async () => {
    const a = createOrbitaDb(currentDbName());
    await a.outbox.add(outbox(crypto.randomUUID()));
    const canonical = Array.from({ length: 300 }, (_, i) => ({
      entity: "concept_progress" as const,
      op_id: crypto.randomUUID(),
      payload: {
        conceptId: `C${i}:capital:countryToCap`,
        iso3: "FRA",
        skill: "capital",
        fsrs_state: 1,
        fsrs_stability: 2,
        fsrs_difficulty: 5,
        fsrs_due: T,
        fsrs_reps: 1,
        fsrs_lapses: 0,
        fsrs_last_review: T,
        version: 1,
        updated_at: T,
      },
    }));
    let release!: () => void;
    const reached = new Promise<void>((sent) => {
      pushReply = (m) => {
        sent();
        return new Promise((r) => {
          release = () => r({ accepted: m.map((x) => x.op_id), rejected: [], canonical });
        });
      };
    });
    const push = runPushOnce();
    await reached;
    // The canonical loop starts only after the outbox row is deleted.
    const applied = async () =>
      (await a.outbox.count()) === 0 ? Math.max(1, await a.concept_progress.count()) : 0;
    const b = await switchMidApply(applied, () => release());
    await push;
    expect(await b.concept_progress.count()).toBe(0);
    a.close();
  });

  it("concurrent swaps to the same DB share one switch", async () => {
    const seen: unknown[] = [];
    const off = onSwap((d) => seen.push(d));
    const [x, y] = await Promise.all([swap(null), swap(null)]);
    off();
    expect(seen).toHaveLength(1);
    expect(x).toBe(getCurrent());
    expect(y).toBe(getCurrent());
  });

  it("outbox rows addressed by op_id", async () => {
    const a = createOrbitaDb(currentDbName());
    const [ok, bad, retry] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await a.outbox.bulkAdd([outbox(ok), outbox(bad), outbox(retry)]);
    pushReply = async () => {
      // The rows are re-stored mid-push under new ids (same op_ids).
      const rows = await a.outbox.toArray();
      await a.outbox.clear();
      await a.outbox.bulkAdd(rows.map(({ id: _id, ...r }) => r));
      return {
        accepted: [ok],
        rejected: [
          { op_id: bad, reason: "invalid_payload" },
          { op_id: retry, reason: "deadlock detected" },
        ],
        canonical: [],
      };
    };
    await runPushOnce();
    const byOp = new Map((await a.outbox.toArray()).map((r) => [r.op_id, r]));
    expect(byOp.has(ok)).toBe(false);
    expect(byOp.get(bad)).toMatchObject({ status: "dead", last_error: "invalid_payload" });
    expect(byOp.get(retry)).toMatchObject({ status: "pending", attempts: 1 });

    // Auth rejection resets the batch to pending by op_id as well.
    pushReply = async () => {
      const rows = await a.outbox.toArray();
      await a.outbox.clear();
      await a.outbox.bulkAdd(rows.map(({ id: _id, ...r }) => r));
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    };
    await a.outbox.where("op_id").equals(retry).modify({ next_attempt_at: 0 });
    await runPushOnce();
    expect(await a.outbox.where("op_id").equals(retry).first()).toMatchObject({
      status: "pending",
      attempts: 1,
    });
    a.close();
  });
});
