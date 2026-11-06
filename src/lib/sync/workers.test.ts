// @vitest-environment jsdom
// v2 sync contract on the client: opaque cursors with a first-page overlap,
// has_more paging, idempotent pull apply, and push rejection handling.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { State } from "ts-fsrs";
import { createMemDb, type MemDb } from "@/test/memoryDexie";
import type { OutboxRow, ConceptProgressRow } from "@/lib/db/orbita-db";
import type { PullResult, PushResult, Mutation } from "./types";

let mem: MemDb = createMemDb();
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("@/lib/db/orbita-db", () => ({ db: () => mem }));
vi.mock("@/lib/db/dbProvider", () => ({
  currentDbName: () => `orbita-${USER}`,
  trackCycle: <T>(p: Promise<T>) => p,
}));

const pullCalls: Record<string, string | null>[] = [];
let pullPages: PullResult[] = [];
const pushCalls: Mutation[][] = [];
let pushReply: (m: Mutation[]) => PushResult = (m) => ({
  accepted: m.map((x) => x.op_id),
  rejected: [],
  canonical: [],
});

vi.mock("./sync.functions", () => ({
  syncPull: vi.fn(async (a: { data: { cursors: Record<string, string | null> } }) => {
    pullCalls.push({ ...a.data.cursors });
    return pullPages.length > 1 ? pullPages.shift()! : pullPages[0];
  }),
  syncPush: vi.fn(async (a: { data: { mutations: Mutation[] } }) => {
    pushCalls.push(a.data.mutations);
    return pushReply(a.data.mutations);
  }),
}));

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: { id: "u" } }, error: null }) as unknown));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut, getUser } } }));
// The exact error thrown by requireSupabaseAuth when GoTrue rejects a deleted user.
const AUTH_ERR = "Unauthorized: Invalid token";

import { runPullOnce, runPushOnce, retryFailed, MAX_PULL_PAGES } from "./workers";
import { useSyncStore } from "./useSyncStore";
import { PULL_OVERLAP_MS } from "./cursor";

const T = Date.UTC(2026, 10, 5, 10, 0, 0);
const ZERO = "00000000-0000-0000-0000-000000000000";
const page = (
  entity: string,
  rows: unknown[],
  cursor: string | null,
  has_more = false,
): PullResult => ({ [entity]: { rows, cursor, has_more } }) as PullResult;

function conceptServerRow(extra: Record<string, unknown> = {}) {
  return {
    conceptId: "FRA:capital:countryToCap",
    iso3: "FRA",
    skill: "capital",
    fsrs_state: 1,
    fsrs_stability: 2.3,
    fsrs_difficulty: 5.5,
    fsrs_due: T + 10 * 60_000,
    fsrs_reps: 1,
    fsrs_lapses: 0,
    fsrs_last_review: T,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_learning_steps: 1,
    version: 4,
    updated_at: T + 5,
    ...extra,
  };
}

function outbox(op_id: string, entity: OutboxRow["entity"] = "question_history"): OutboxRow {
  return {
    op_id,
    entity,
    op: "upsert",
    payload: { a: 1 },
    created_at: T,
    attempts: 0,
    next_attempt_at: 0,
    status: "pending",
  };
}
const allOutbox = async () => (await mem.outbox.toArray()) as unknown as OutboxRow[];

beforeEach(() => {
  mem = createMemDb();
  pullCalls.length = 0;
  pushCalls.length = 0;
  pullPages = [{}];
  pushReply = (m) => ({ accepted: m.map((x) => x.op_id), rejected: [], canonical: [] });
  useSyncStore.setState({ signedIn: true, status: "idle", lastError: null });
});

describe("pull cursors", () => {
  it("first page overlaps by 15 s, continuation pages send the server cursor as-is", async () => {
    const stored = `${T}|FRA:capital:countryToCap`;
    await mem.sync_meta.put({ key: "cursor_concept_progress", value: stored });
    pullPages = [
      page("concept_progress", [conceptServerRow()], `${T + 10}|AAA`, true),
      page("concept_progress", [conceptServerRow({ conceptId: "ESP:x:y" })], `${T + 20}|BBB`, true),
      page("concept_progress", [], `${T + 20}|BBB`, false),
    ];
    await runPullOnce();
    expect(pullCalls).toHaveLength(3);
    expect(pullCalls[0].concept_progress).toBe(`${T - PULL_OVERLAP_MS - 1}|${ZERO}`);
    expect(pullCalls[1].concept_progress).toBe(`${T + 10}|AAA`);
    expect(pullCalls[2].concept_progress).toBe(`${T + 20}|BBB`);
    // Overlap only on page 1.
    const overlapped = pullCalls.filter((c) => c.concept_progress?.endsWith(`|${ZERO}`));
    expect(overlapped).toHaveLength(1);
    expect((await mem.sync_meta.get("cursor_concept_progress"))?.value).toBe(`${T + 20}|BBB`);
  });

  it("a null cursor is sent as null and an unparseable one unchanged", async () => {
    await mem.sync_meta.put({ key: "cursor_unlocks", value: "2026-11-05T10:00:00Z" });
    await runPullOnce();
    expect(pullCalls[0].concept_progress).toBeNull();
    expect(pullCalls[0].unlocks).toBe("2026-11-05T10:00:00Z");
  });

  it("a cycle whose pages keep reporting has_more still terminates", async () => {
    let n = 0;
    pullPages = [];
    for (let i = 0; i < MAX_PULL_PAGES + 5; i++) {
      n++;
      pullPages.push(page("question_history", [], `${T + n}|${ZERO}`, true));
    }
    await runPullOnce();
    expect(pullCalls.length).toBe(MAX_PULL_PAGES);
    expect(pullCalls.filter((c) => c.question_history === null)).toHaveLength(1);
  });

  it("the overlap never moves the stored cursor backwards", async () => {
    const stored = `${T}|FRA`;
    await mem.sync_meta.put({ key: "cursor_country_progress", value: stored });
    const echoed = `${T - PULL_OVERLAP_MS - 1}|${ZERO}`;
    const older = {
      country_code: "ESP",
      skills: {},
      skill_versions: {},
      last_seen_at: T - 9000,
      updated_at: T - 9000,
    };
    pullPages = [page("country_progress", [older], `${T - 9000}|ESP`, false)];
    await runPullOnce();
    expect((await mem.sync_meta.get("cursor_country_progress"))?.value).toBe(stored);
    pullPages = [page("country_progress", [], echoed, false)];
    await runPullOnce();
    expect((await mem.sync_meta.get("cursor_country_progress"))?.value).toBe(stored);
  });
});

describe("pull apply", () => {
  it("writes question_history rows idempotently by op_id", async () => {
    const op = crypto.randomUUID();
    const row = {
      op_id: op,
      conceptId: "FRA:capital:countryToCap",
      sessionId: "s",
      grade: 3,
      mode: "easy",
      direction: "d",
      fsrs_log: null,
      responseMs: 900,
      correct: true,
      answeredAt: T,
      updated_at: T,
    };
    pullPages = [page("question_history", [row], `${T}|${op}`)];
    await runPullOnce();
    await runPullOnce(); // overlap re-reads the same row
    const rows = await mem.question_history.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ op_id: op, answeredAt: T, correct: true, grade: 3 });
  });

  it("concept rows carry learning_steps, elapsed and scheduled days", async () => {
    pullPages = [
      page(
        "concept_progress",
        [conceptServerRow({ fsrs_elapsed_days: 2, fsrs_scheduled_days: 5 })],
        `${T}|x`,
      ),
    ];
    await runPullOnce();
    const r = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(r).toMatchObject({
      fsrs_learning_steps: 1,
      fsrs_elapsed_days: 2,
      fsrs_scheduled_days: 5,
      fsrs_state: State.Learning,
      user_id: USER,
      dirty: 0,
    });
  });

  it("an older server review never overwrites a newer local one, and re-applying is harmless", async () => {
    await mem.concept_progress.put({
      ...conceptServerRow({ fsrs_last_review: T + 1000, version: 1 }),
      dirty: 0,
    } as never);
    pullPages = [
      page("concept_progress", [conceptServerRow({ fsrs_last_review: T, version: 99 })], `${T}|x`),
    ];
    await runPullOnce();
    const r = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(r.fsrs_last_review).toBe(T + 1000);
  });

  it("a newer server review replaces a clean local row", async () => {
    await mem.concept_progress.put({
      ...conceptServerRow({ fsrs_last_review: T - 1000, version: 9 }),
      dirty: 0,
    } as never);
    pullPages = [
      page("concept_progress", [conceptServerRow({ fsrs_last_review: T, version: 2 })], `${T}|x`),
    ];
    await runPullOnce();
    const r = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(r.fsrs_last_review).toBe(T);
  });

  it("daily_summary merges with max per column and keeps the local dirty flag", async () => {
    await mem.daily_summary.put({
      dateKey: "2026-11-05",
      reviewsCount: 5,
      correctCount: 4,
      timeSpentMs: 1000,
      updated_at: T,
      dirty: 1,
    });
    pullPages = [
      page(
        "daily_summary",
        [
          {
            dateKey: "2026-11-05",
            reviewsCount: 3,
            correctCount: 6,
            timeSpentMs: 500,
            updated_at: T,
          },
        ],
        `${T}|2026-11-05`,
      ),
    ];
    await runPullOnce();
    expect(await mem.daily_summary.get("2026-11-05")).toMatchObject({
      reviewsCount: 5,
      correctCount: 6,
      timeSpentMs: 1000,
      dirty: 1,
    });
  });

  it("country_progress last_seen_at and unlocks unlocked_at are read as ms numbers", async () => {
    pullPages = [
      {
        country_progress: {
          rows: [
            { country_code: "FRA", skills: {}, skill_versions: {}, last_seen_at: T, updated_at: T },
          ],
          cursor: `${T}|FRA`,
          has_more: false,
        },
        unlocks: {
          rows: [{ key: "k", progress: 1, unlocked_at: T, updated_at: T }],
          cursor: `${T}|k`,
          has_more: false,
        },
      },
    ];
    await runPullOnce();
    expect((await mem.countryProgress.get("FRA"))?.lastSeenAt).toBe(T);
    expect((await mem.unlocks.get("k"))?.unlockedAt).toBe(T);
  });
});

describe("pull never overwrites local changes", () => {
  const ID = "FRA:capital:countryToCap";
  const conceptOp = (status: OutboxRow["status"], conceptId = ID): OutboxRow => ({
    ...outbox(crypto.randomUUID(), "concept_progress"),
    payload: { conceptId },
    status,
  });
  const local = async () => (await mem.concept_progress.get(ID)) as unknown as ConceptProgressRow;

  it("pull never overwrites dirty row", async () => {
    // What recordConceptAttempt leaves: dirty row + its op, here mid-push.
    await mem.concept_progress.put({ ...conceptServerRow({ fsrs_last_review: T - 1000 }), dirty: 1 } as never);
    await mem.outbox.put(conceptOp("in_flight") as never);
    pullPages = [page("concept_progress", [conceptServerRow({ fsrs_last_review: T })], `${T}|x`)];
    await runPullOnce();
    expect(await local()).toMatchObject({ fsrs_last_review: T - 1000, dirty: 1 });
  });

  it("a pending op for the same key blocks the pulled row, one for another key does not", async () => {
    await mem.concept_progress.put({ ...conceptServerRow({ fsrs_last_review: T - 1000 }), dirty: 0 } as never);
    await mem.outbox.put(conceptOp("pending") as never);
    await mem.outbox.put(conceptOp("pending", "DEU:capital:countryToCap") as never);
    pullPages = [page("concept_progress", [conceptServerRow({ fsrs_last_review: T })], `${T}|x`)];
    await runPullOnce();
    expect((await local()).fsrs_last_review).toBe(T - 1000);

    // Once the op is gone (here: dead), the newer review applies on the next pull.
    const [mine] = (await allOutbox()).filter((r) => r.payload.conceptId === ID);
    await mem.outbox.where("op_id").equals(mine.op_id).modify({ status: "dead" });
    await runPullOnce();
    expect((await local()).fsrs_last_review).toBe(T);
  });

  it("a canonical never overwrites a local row that still has an op queued", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op, "concept_progress") as never);
    await mem.outbox.put({ ...conceptOp("pending"), next_attempt_at: Date.now() + 1e6 } as never);
    await mem.concept_progress.put({ ...conceptServerRow({ fsrs_last_review: T - 1000 }), dirty: 1 } as never);
    pushReply = () => ({
      accepted: [],
      rejected: [{ op_id: op, reason: "stale_review" }],
      canonical: [{ entity: "concept_progress", op_id: op, payload: conceptServerRow() }],
    });
    await runPushOnce();
    expect(await local()).toMatchObject({ fsrs_last_review: T - 1000, dirty: 1 });
  });

  it("country_progress merges per skill keeping the higher version", async () => {
    await mem.countryProgress.put({
      iso3: "FRA",
      skills: { capital: { local: true }, flag: { local: true } },
      skill_versions: { capital: 5, flag: 1 },
      lastSeenAt: T + 1,
      dirty: 1,
    });
    pullPages = [
      page(
        "country_progress",
        [
          {
            country_code: "FRA",
            skills: { capital: { server: true }, flag: { server: true }, location: { server: true } },
            skill_versions: { capital: 4, flag: 2, location: 1 },
            last_seen_at: T,
          },
        ],
        `${T}|FRA`,
      ),
    ];
    await runPullOnce();
    expect(await mem.countryProgress.get("FRA")).toMatchObject({
      skills: { capital: { local: true }, flag: { server: true }, location: { server: true } },
      skill_versions: { capital: 5, flag: 2, location: 1 },
      lastSeenAt: T + 1,
      dirty: 1,
    });
  });

  it("unlocks merge like the server: progress max, earliest unlock date", async () => {
    await mem.unlocks.put({ key: "k", progress: 5, unlockedAt: null, updatedAt: T });
    pullPages = [page("unlocks", [{ key: "k", progress: 3, unlocked_at: T }], `${T}|k`)];
    await runPullOnce();
    expect(await mem.unlocks.get("k")).toMatchObject({ progress: 5, unlockedAt: T });
  });

  it("a Dexie write failure does not advance the cursor", async () => {
    mem.concept_progress.put = async () => {
      throw new Error("QuotaExceededError");
    };
    pullPages = [page("concept_progress", [conceptServerRow()], `${T}|x`)];
    await runPullOnce();
    expect(await mem.sync_meta.get("cursor_concept_progress")).toBeUndefined();
    expect(useSyncStore.getState().lastError).toMatch(/Quota/);
  });
});

describe("push result handling", () => {
  it("an invalid op_id is marked dead locally and never reaches the RPC", async () => {
    await mem.outbox.put(outbox("abc:cp") as never);
    await runPushOnce();
    expect(pushCalls).toHaveLength(0);
    const [r] = await allOutbox();
    expect(r.status).toBe("dead");
    expect(r.last_error).toBe("invalid_op_id");
  });

  it("valid op_ids in the same batch are still sent", async () => {
    const good = crypto.randomUUID();
    await mem.outbox.put(outbox("not-a-uuid") as never);
    await mem.outbox.put(outbox(good) as never);
    await runPushOnce();
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].map((m) => m.op_id)).toEqual([good]);
    const rows = await allOutbox();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("dead");
  });

  it.each(["invalid_payload", "invalid_op_id", "unknown_entity"])(
    "reason %s goes dead immediately",
    async (reason) => {
      const op = crypto.randomUUID();
      await mem.outbox.put(outbox(op) as never);
      pushReply = () => ({ accepted: [], rejected: [{ op_id: op, reason }], canonical: [] });
      await runPushOnce();
      const [r] = await allOutbox();
      expect(r.status).toBe("dead");
      expect(r.last_error).toBe(reason);
      expect(r.attempts).toBe(1);
    },
  );

  it("stale_review applies the full canonical row and drops the outbox item", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op, "concept_progress") as never);
    await mem.concept_progress.put({
      ...conceptServerRow({ fsrs_last_review: T - 5000, fsrs_learning_steps: 0 }),
      dirty: 1,
    } as never);
    const canon = conceptServerRow({
      fsrs_elapsed_days: 3,
      fsrs_scheduled_days: 7,
      fsrs_learning_steps: 1,
      version: 8,
    });
    pushReply = () => ({
      accepted: [],
      rejected: [{ op_id: op, reason: "stale_review" }],
      canonical: [{ entity: "concept_progress", op_id: op, payload: canon }],
    });
    await runPushOnce();
    expect(await allOutbox()).toHaveLength(0);
    const r = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(r).toMatchObject({
      fsrs_last_review: T,
      fsrs_elapsed_days: 3,
      fsrs_scheduled_days: 7,
      fsrs_learning_steps: 1,
      version: 8,
      dirty: 0,
    });
  });

  it("stale_review never rolls back a newer local review", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op, "concept_progress") as never);
    const newer = { ...conceptServerRow({ fsrs_last_review: T + 60_000, fsrs_reps: 2 }), dirty: 1 };
    await mem.concept_progress.put(newer as never);
    pushReply = () => ({
      accepted: [],
      rejected: [{ op_id: op, reason: "stale_review" }],
      canonical: [
        { entity: "concept_progress", op_id: op, payload: conceptServerRow({ version: 8 }) },
      ],
    });
    await runPushOnce();
    expect(await allOutbox()).toHaveLength(0);
    const r = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(r).toMatchObject({ fsrs_last_review: T + 60_000, fsrs_reps: 2, dirty: 1 });
  });

  it("other reasons keep the retry behaviour", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op) as never);
    pushReply = () => ({
      accepted: [],
      rejected: [{ op_id: op, reason: "deadlock detected" }],
      canonical: [],
    });
    await runPushOnce();
    const [r] = await allOutbox();
    expect(r.status).toBe("pending");
    expect(r.attempts).toBe(1);
    expect(r.next_attempt_at).toBeGreaterThan(Date.now());
  });

  it("a push failing with a user foreign-key error signs out instead of burning retries", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op) as never);
    pushReply = () => {
      throw new Error('insert or update on table "unlocks" violates foreign key constraint "unlocks_user_id_fkey"');
    };
    await runPushOnce();
    expect(signOut).toHaveBeenCalledTimes(1);
    const [r] = await allOutbox();
    expect(r.status).toBe("pending");
    expect(r.attempts).toBe(0);
  });

  it("a per-item user FK rejection (the real server shape) signs out once and keeps every row pending", async () => {
    signOut.mockClear();
    const ops = [crypto.randomUUID(), crypto.randomUUID()];
    for (const op of ops) await mem.outbox.put(outbox(op) as never);
    pushReply = (m) => ({
      accepted: [],
      rejected: [
        {
          op_id: m[0].op_id,
          reason:
            'insert or update on table "concept_progress" violates foreign key constraint "concept_progress_user_id_fkey"',
        },
        { op_id: m[1].op_id, reason: "invalid_payload" },
      ],
      canonical: [],
    });
    await runPushOnce();
    expect(signOut).toHaveBeenCalledTimes(1);
    const rows = await allOutbox();
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.status).toBe("pending");
      expect(r.attempts).toBe(0);
    }
  });

  describe("auth rejection by the middleware (deleted user)", () => {
    beforeEach(() => {
      signOut.mockClear();
      getUser.mockClear();
      getUser.mockImplementation(async () => ({ data: { user: { id: "u" } }, error: null }));
    });
    const authFail = () => {
      pushReply = () => {
        throw Object.assign(new Error(AUTH_ERR), { statusCode: 401 });
      };
    };

    it("keeps rows pending without spending attempts and signs out when the user is gone", async () => {
      const op = crypto.randomUUID();
      await mem.outbox.put(outbox(op) as never);
      authFail();
      getUser.mockImplementation(async () => ({
        data: { user: null },
        error: { status: 403, message: "User from sub claim in JWT does not exist" },
      }));
      await runPushOnce();
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledTimes(1);
      const [r] = await allOutbox();
      expect(r.status).toBe("pending");
      expect(r.attempts).toBe(0);
    });

    it("does not sign out when getUser succeeds (transient hiccup) and spends no attempts", async () => {
      const op = crypto.randomUUID();
      await mem.outbox.put(outbox(op) as never);
      authFail();
      await runPushOnce();
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(signOut).not.toHaveBeenCalled();
      const [r] = await allOutbox();
      expect(r.status).toBe("pending");
      expect(r.attempts).toBe(0);
      expect(r.next_attempt_at).toBeGreaterThan(Date.now());
    });

    const expectKept = async () => {
      const [r] = await allOutbox();
      expect(r.status).toBe("pending");
      expect(r.attempts).toBe(0);
    };

    it.each([
      ["a retryable fetch error (503)", { name: "AuthRetryableFetchError", status: 503 }],
      ["a rate limit (429)", { name: "AuthApiError", status: 429 }],
    ])("does NOT sign out when getUser answers with %s", async (_label, error) => {
      await mem.outbox.put(outbox(crypto.randomUUID()) as never);
      authFail();
      getUser.mockImplementation(async () => ({ data: { user: null }, error }));
      await runPushOnce();
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(signOut).not.toHaveBeenCalled();
      await expectKept();
    });

    it("does NOT sign out when getUser throws (network down)", async () => {
      await mem.outbox.put(outbox(crypto.randomUUID()) as never);
      authFail();
      getUser.mockImplementation(async () => {
        throw new TypeError("Failed to fetch");
      });
      await runPushOnce();
      expect(signOut).not.toHaveBeenCalled();
      await expectKept();
    });

    it.each([
      ["AuthSessionMissingError (400)", { name: "AuthSessionMissingError", status: 400 }, { user: null }],
      ["status 401", { name: "AuthApiError", status: 401 }, { user: null }],
      ["status 404", { name: "AuthApiError", status: 404 }, { user: null }],
      ["no error and no user", null, { user: null }],
    ])("signs out on a definitive answer: %s", async (_label, error, data) => {
      await mem.outbox.put(outbox(crypto.randomUUID()) as never);
      authFail();
      getUser.mockImplementation(async () => ({ data, error }));
      await runPushOnce();
      expect(signOut).toHaveBeenCalledTimes(1);
      await expectKept();
    });

    it("a pull failing with the auth error also checks the session and signs out", async () => {
      authFail();
      const { syncPull } = await import("./sync.functions");
      (syncPull as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
        throw Object.assign(new Error(AUTH_ERR), { statusCode: 401 });
      });
      getUser.mockImplementation(async () => ({ data: { user: null }, error: { status: 403 } }));
      await runPullOnce();
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  it("other push errors keep retrying without signing out", async () => {
    signOut.mockClear();
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op) as never);
    pushReply = () => {
      throw new Error("network down");
    };
    await runPushOnce();
    expect(signOut).not.toHaveBeenCalled();
    const [r] = await allOutbox();
    expect(r.attempts).toBe(0);
  });

  it("20 network failures in a row never dead-letter, and backoff stays within 5 minutes", async () => {
    await mem.outbox.put(outbox(crypto.randomUUID()) as never);
    pushReply = () => {
      throw new Error("network down");
    };
    for (let i = 0; i < 20; i++) {
      await mem.outbox.filter(() => true).modify({ next_attempt_at: 0 });
      await runPushOnce();
    }
    const [r] = await allOutbox();
    expect(r.status).toBe("pending");
    expect(r.attempts).toBe(0);
    expect(r.next_attempt_at).toBeLessThanOrEqual(Date.now() + 300_000 + 500);
  });

  it("a server rejection 10 times ends in dead", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op) as never);
    pushReply = () => ({ accepted: [], rejected: [{ op_id: op, reason: "deadlock detected" }], canonical: [] });
    for (let i = 0; i < 10; i++) {
      await mem.outbox.filter(() => true).modify({ next_attempt_at: 0 });
      await runPushOnce();
    }
    const [r] = await allOutbox();
    expect(r.status).toBe("dead");
    expect(r.attempts).toBe(10);
  });

  it("Retry failed returns dead rows to pending, due now, with attempts 0", async () => {
    await mem.outbox.put({ ...outbox(crypto.randomUUID()), status: "dead", attempts: 10, next_attempt_at: Date.now() + 1e6 } as never);
    await retryFailed();
    const [r] = await allOutbox();
    expect(r).toMatchObject({ status: "pending", attempts: 0 });
    expect(r.next_attempt_at).toBeLessThanOrEqual(Date.now());
    expect(useSyncStore.getState().dead).toBe(0);
  });

  it("country_progress canonical uses the server last_seen_at", async () => {
    const op = crypto.randomUUID();
    await mem.outbox.put(outbox(op, "country_progress") as never);
    await mem.countryProgress.put({ iso3: "FRA", skills: {}, skill_versions: {}, lastSeenAt: 1 });
    pushReply = () => ({
      accepted: [op],
      rejected: [],
      canonical: [
        {
          entity: "country_progress",
          op_id: op,
          payload: { country_code: "FRA", skills: {}, skill_versions: {}, last_seen_at: T },
        },
      ],
    });
    await runPushOnce();
    expect((await mem.countryProgress.get("FRA"))?.lastSeenAt).toBe(T);
  });
});
