// @vitest-environment node
// End to end: the real client payload builders, push/pull workers, cursor
// overlap and apply code against the v2 baseline schema in PGlite. Only the
// server-fn transport (sync.functions.ts) and Dexie (in-memory) are faked.
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { State } from "ts-fsrs";
import { createTestDb, defaultMigrationFiles, type TestDb } from "@/test/pglite";
import { createMemDb, type MemDb } from "@/test/memoryDexie";
import type { ConceptProgressRow, OutboxRow } from "@/lib/db/orbita-db";
import type { Mutation } from "./types";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let mem: MemDb = createMemDb();
let t: TestDb;

vi.mock("@/lib/db/orbita-db", () => ({ db: () => mem }));
vi.mock("@/lib/db/dbProvider", () => ({ currentDbName: () => `orbita-${USER}` }));
vi.mock("./sync.functions", () => ({
  syncPush: (a: { data: { mutations: Mutation[] } }) =>
    t.call("sync_push", { _mutations: a.data.mutations }),
  syncPull: (a: { data: { cursors: Record<string, string | null>; limit?: number } }) =>
    t.call("sync_pull", { _cursors: a.data.cursors, _limit: a.data.limit ?? 500 }),
}));

import { runPullOnce, runPushOnce } from "./workers";
import { useSyncStore } from "./useSyncStore";
import {
  conceptProgressPayload,
  countryProgressPayload,
  dailyStreakPayload,
  questionHistoryPayload,
  sessionsLogPayload,
  unlockPayload,
} from "./payloads";
import { overlapCursor } from "./cursor";

const T = Date.UTC(2026, 10, 5, 10, 0, 0);

function concept(extra: Partial<ConceptProgressRow> = {}): ConceptProgressRow {
  return {
    conceptId: "FRA:capital:countryToCap",
    iso3: "FRA",
    skill: "capital",
    fsrs_state: State.Learning,
    fsrs_stability: 2.3,
    fsrs_difficulty: 5.5,
    fsrs_due: T + 10 * 60_000,
    fsrs_reps: 1,
    fsrs_lapses: 0,
    fsrs_last_review: T,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_learning_steps: 1,
    updated_at: T,
    version: 1,
    dirty: 1,
    ...extra,
  };
}

let seq = 0;
async function queue(
  entity: OutboxRow["entity"],
  payload: Record<string, unknown>,
  op_id = crypto.randomUUID(),
) {
  await mem.outbox.put({
    op_id,
    entity,
    op: "upsert",
    payload: { ...payload, client_id: "dev-1" },
    created_at: T + seq++,
    attempts: 0,
    next_attempt_at: 0,
    status: "pending",
  } as never);
}
const outbox = async () => (await mem.outbox.toArray()) as unknown as OutboxRow[];

function history(op_id: string, answeredAt = T) {
  return questionHistoryPayload({
    op_id,
    conceptId: "FRA:capital:countryToCap",
    sessionId: "s1",
    grade: 3,
    mode: "easy",
    direction: "country->capital",
    fsrs_log: JSON.stringify({ rating: 3 }),
    responseMs: 1200,
    correct: true,
    answeredAt,
  });
}

beforeAll(async () => {
  // Node's navigator has no onLine; the workers treat that as offline.
  vi.stubGlobal("navigator", { onLine: true });
  t = await createTestDb(defaultMigrationFiles(), { supabaseDefaultGrants: false });
  await t.asUser(USER);
}, 60_000);

beforeEach(() => {
  mem = createMemDb();
  useSyncStore.setState({ signedIn: true, status: "idle", lastError: null });
});

describe("client <-> v2 baseline", () => {
  it("every builder's payload is accepted and pulls back on a second device", async () => {
    const qh = crypto.randomUUID();
    await queue("concept_progress", conceptProgressPayload(concept())!);
    await queue("question_history", history(qh), qh);
    await queue(
      "country_progress",
      countryProgressPayload({
        iso3: "FRA",
        skills: {},
        skill_versions: { capital: 1 },
        lastSeenAt: T,
      }),
    );
    await queue("unlocks", unlockPayload({ key: "first", progress: 1, unlockedAt: T }));
    await queue("unlocks", unlockPayload({ key: "second", progress: 0.5, unlockedAt: null }));
    const sid = crypto.randomUUID();
    await queue(
      "sessions_log",
      sessionsLogPayload({
        mode: "capital",
        skill: "capital",
        score: 5,
        totalQuestions: 5,
        correct: 4,
        wrong: 1,
        bestCombo: 2,
        durationMs: 60_000,
        createdAt: T,
      }),
      sid,
    );
    await queue("daily_streak", dailyStreakPayload("2026-11-05", T));
    await queue("daily_summary", {
      dateKey: "2026-11-05",
      reviewsCount: 5,
      correctCount: 4,
      timeSpentMs: 9000,
    });

    await runPushOnce();
    const left = await outbox();
    expect(left.map((r) => `${r.entity}:${r.last_error}`)).toEqual([]);

    // Second device: empty Dexie, full pull.
    mem = createMemDb();
    await runPullOnce();
    const c = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(c).toMatchObject({
      fsrs_learning_steps: 1,
      fsrs_last_review: T,
      fsrs_due: T + 10 * 60_000,
      fsrs_state: State.Learning,
    });
    expect(await mem.question_history.get(qh)).toMatchObject({
      op_id: qh,
      answeredAt: T,
      grade: 3,
      correct: true,
    });
    expect((await mem.countryProgress.get("FRA"))?.lastSeenAt).toBe(T);
    expect((await mem.unlocks.get("first"))?.unlockedAt).toBe(T);
    expect((await mem.unlocks.get("second"))?.unlockedAt).toBeNull();
    expect(await mem.daily_summary.get("2026-11-05")).toMatchObject({
      reviewsCount: 5,
      timeSpentMs: 9000,
    });
  });

  it("an ISO date (v1 payload) is rejected as invalid_payload and goes dead at once", async () => {
    await queue("country_progress", {
      country_code: "ESP",
      skills: {},
      skill_versions: {},
      last_seen_at: new Date(T).toISOString(),
    });
    await runPushOnce();
    const [r] = await outbox();
    expect(r).toMatchObject({ status: "dead", last_error: "invalid_payload", attempts: 1 });
  });

  it("stale_review applies the server canonical with learning steps", async () => {
    await queue(
      "concept_progress",
      conceptProgressPayload(concept({ fsrs_last_review: T - 60_000, fsrs_learning_steps: 0 }))!,
    );
    await mem.concept_progress.put(
      concept({ fsrs_last_review: T - 60_000, fsrs_learning_steps: 0 }) as never,
    );
    await runPushOnce();
    expect(await outbox()).toHaveLength(0);
    const c = (await mem.concept_progress.get(
      "FRA:capital:countryToCap",
    )) as unknown as ConceptProgressRow;
    expect(c).toMatchObject({ fsrs_last_review: T, fsrs_learning_steps: 1, dirty: 0 });
  });

  it("pages through has_more in one cycle and the overlap re-read is harmless", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await queue("question_history", history(id, T + i), id);
    }
    await runPushOnce();
    mem = createMemDb();
    await runPullOnce({ limit: 2 });
    const got = (await mem.question_history.toArray()).map((r) => r.op_id);
    for (const id of ids) expect(got).toContain(id);
    const total = got.length;
    const cursor = (await mem.sync_meta.get("cursor_question_history"))?.value;
    expect(cursor).toMatch(/^\d+\|[0-9a-f-]{36}$/);
    // Next cycle overlaps 15 s: same rows re-read, nothing duplicated.
    await runPullOnce({ limit: 2 });
    expect(await mem.question_history.toArray()).toHaveLength(total);
  });

  it("the server parses the overlapped cursor (it does not restart from the beginning)", async () => {
    const future = `${Date.now() + 3_600_000}|00000000-0000-0000-0000-000000000001`;
    const out = await t.call<
      Record<string, { rows: unknown[]; cursor: string | null; has_more: boolean }>
    >("sync_pull", { _cursors: { question_history: overlapCursor(future) }, _limit: 500 });
    expect(out.question_history.rows).toHaveLength(0);
    const fromStart = await t.call<typeof out>("sync_pull", {
      _cursors: { question_history: null },
      _limit: 500,
    });
    expect(fromStart.question_history.rows.length).toBeGreaterThan(0);
  });
});
