// @vitest-environment node
// Contract tests for the v2 baseline schema (supabase/migrations/20261106000000_baseline_v2.sql).
// The DB is created WITHOUT Supabase's default privileges so only the
// baseline's explicit grants apply (Ruling 5).
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, defaultMigrationFiles, type TestDb } from "@/test/pglite";

const FILES = defaultMigrationFiles();
const OPTS = { supabaseDefaultGrants: false };

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Row = Record<string, unknown>;
interface PushResult {
  accepted: string[];
  rejected: { op_id: string | null; reason: string }[];
  canonical: { entity: string; op_id: string; payload: Row }[];
}
interface PullEntity {
  rows: Row[];
  cursor: string | null;
  has_more?: boolean;
}
type PullResult = Record<string, PullEntity>;

const uuid = () => crypto.randomUUID();
const T0 = Date.parse("2026-11-01T10:00:00.000Z");
const MIN = 60_000;
const DAY = 86_400_000;

function conceptPayload(conceptId: string, lastReview: number, extra: Row = {}): Row {
  return {
    conceptId,
    iso3: conceptId.split(":")[0],
    skill: conceptId.split(":")[1] ?? "location",
    fsrs_state: 2,
    fsrs_stability: 3.5,
    fsrs_difficulty: 5.1,
    fsrs_due: lastReview + 3 * DAY,
    fsrs_reps: 3,
    fsrs_lapses: 0,
    fsrs_last_review: lastReview,
    fsrs_elapsed_days: 1,
    fsrs_scheduled_days: 3,
    fsrs_learning_steps: 0,
    version: 1,
    updated_at: lastReview,
    client_id: "client-x",
    ...extra,
  };
}

function mut(entity: string, payload: Row, op_id: string = uuid()) {
  return { op_id, entity, op: "upsert", payload };
}

describe("baseline v2 contract", () => {
  let t: TestDb;
  const push = (muts: unknown[]) => t.call<PushResult>("sync_push", { _mutations: muts });
  const pull = (cursors: Record<string, string | null> = {}, limit = 500) =>
    t.call<PullResult>("sync_pull", { _cursors: cursors, _limit: limit });

  beforeAll(async () => {
    t = await createTestDb(FILES, OPTS);
  }, 60_000);

  it("latest review wins across clients", async () => {
    const user = uuid();
    const cid = "FRA:capital";
    await t.asUser(user);

    // Device X reviews at T0+10m (first write).
    const r1 = await push([
      mut("concept_progress", conceptPayload(cid, T0 + 10 * MIN, { version: 1, client_id: "X" })),
    ]);
    expect(r1.rejected).toEqual([]);
    expect(r1.accepted).toHaveLength(1);

    // Device Y pushes an OLDER review with a much higher local version counter: must lose.
    const older = mut(
      "concept_progress",
      conceptPayload(cid, T0 + 5 * MIN, { version: 9, fsrs_reps: 9, client_id: "Y" }),
    );
    const r2 = await push([older]);
    expect(r2.accepted).toEqual([]);
    expect(r2.rejected).toHaveLength(1);
    expect(r2.rejected[0].op_id).toBe(older.op_id);
    expect(r2.canonical).toHaveLength(1);
    expect(r2.canonical[0].entity).toBe("concept_progress");
    expect(r2.canonical[0].op_id).toBe(older.op_id);
    expect(r2.canonical[0].payload.conceptId).toBe(cid);
    expect(r2.canonical[0].payload.fsrs_last_review).toBe(T0 + 10 * MIN);
    expect(r2.canonical[0].payload.fsrs_reps).toBe(3);

    // Same last_review (retry / tie): the existing row stays.
    const tie = mut(
      "concept_progress",
      conceptPayload(cid, T0 + 10 * MIN, { fsrs_reps: 7, version: 50 }),
    );
    const r3 = await push([tie]);
    expect(r3.accepted).toEqual([]);
    expect(r3.canonical[0].payload.fsrs_reps).toBe(3);

    // Device Y reviews later with a LOW local version: newer review wins, server assigns version.
    const newer = mut(
      "concept_progress",
      conceptPayload(cid, T0 + 30 * MIN, { version: 1, fsrs_reps: 4, client_id: "Y" }),
    );
    const r4 = await push([newer]);
    expect(r4.accepted).toEqual([newer.op_id]);

    const p = await pull();
    const rows = p.concept_progress.rows.filter((r) => r.conceptId === cid);
    expect(rows).toHaveLength(1);
    expect(rows[0].fsrs_last_review).toBe(T0 + 30 * MIN);
    expect(rows[0].fsrs_reps).toBe(4);
    expect(rows[0].version).toBe(2);
  });

  it("pull pages through ties", async () => {
    const user = uuid();
    await t.asUser(user);
    // One push = one transaction = the same updated_at for all 7 rows.
    const muts = Array.from({ length: 7 }, (_, i) =>
      mut("concept_progress", conceptPayload(`C${i}:location`, T0 + i * MIN)),
    );
    const r = await push(muts);
    expect(r.accepted).toHaveLength(7);

    const stamps = await t.db.query<{ n: number }>(
      "select count(distinct updated_at)::int as n from public.concept_progress",
    );
    expect(stamps.rows[0].n).toBe(1);

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 3; i++) {
      const p = await pull({ concept_progress: cursor }, 3);
      const page = p.concept_progress;
      seen.push(...page.rows.map((x) => String(x.conceptId)));
      cursor = page.cursor;
      expect(typeof cursor).toBe("string");
      expect(cursor).toMatch(/^\d+\|.+$/);
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    const last = await pull({ concept_progress: cursor }, 3);
    expect(last.concept_progress.rows).toEqual([]);
    expect(last.concept_progress.cursor).toBe(cursor);
  });

  it("invalid op_id rejects only that item", async () => {
    const user = uuid();
    await t.asUser(user);
    const good1 = mut("unlocks", { key: "k1", progress: 1, unlocked_at: null, meta: null });
    const bad = mut("unlocks", { key: "k2", progress: 1, unlocked_at: null }, "abc:cp");
    const good2 = mut("daily_streak", { date_key: "2026-11-01", count: 1, last_active_at: T0 });
    const r = await push([good1, bad, good2]);
    expect(r.accepted).toEqual([good1.op_id, good2.op_id]);
    expect(r.rejected).toEqual([{ op_id: "abc:cp", reason: "invalid_op_id" }]);
    const n = await t.db.query<{ n: number }>("select count(*)::int as n from public.unlocks");
    expect(n.rows[0].n).toBe(1);
  });

  it("non-numeric date rejected as invalid_payload", async () => {
    const user = uuid();
    await t.asUser(user);
    const isoDue = mut(
      "concept_progress",
      conceptPayload("DEU:capital", T0, { fsrs_due: "2026-11-05T10:00:00.000Z" }),
    );
    const nullReview = mut(
      "concept_progress",
      conceptPayload("ESP:capital", T0, { fsrs_last_review: null }),
    );
    const isoSeen = mut("country_progress", {
      country_code: "DEU",
      skills: { capital: { seen: 1 } },
      skill_versions: { capital: 1 },
      last_seen_at: "2026-11-05T10:00:00.000Z",
    });
    const isoStarted = mut("sessions_log", {
      mode: "find",
      score: 1,
      started_at: "yesterday",
      ended_at: T0,
    });
    const ok = mut("country_progress", {
      country_code: "ITA",
      skills: { capital: { seen: 1 } },
      skill_versions: { capital: 1 },
      last_seen_at: T0,
    });
    const r = await push([isoDue, nullReview, isoSeen, isoStarted, ok]);
    expect(r.rejected).toEqual([
      { op_id: isoDue.op_id, reason: "invalid_payload" },
      { op_id: nullReview.op_id, reason: "invalid_payload" },
      { op_id: isoSeen.op_id, reason: "invalid_payload" },
      { op_id: isoStarted.op_id, reason: "invalid_payload" },
    ]);
    expect(r.accepted).toEqual([ok.op_id]);
    const cp = r.canonical.find((c) => c.op_id === ok.op_id)!;
    expect(cp.payload.country_code).toBe("ITA");
    expect(cp.payload.last_seen_at).toBe(T0);
    const n = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.concept_progress",
    );
    expect(n.rows[0].n).toBe(0);
  });

  it("unknown entity is rejected, profiles branch writes", async () => {
    const user = uuid();
    await t.asUser(user);
    const unknown = mut("bogus", { x: 1 });
    const prof = mut("profiles", { display_name: "Carla", avatar_flag: "ESP" });
    const r = await push([unknown, prof]);
    expect(r.rejected).toEqual([{ op_id: unknown.op_id, reason: "unknown_entity" }]);
    expect(r.accepted).toEqual([prof.op_id]);
    const p = await pull();
    expect(p.profiles.rows).toHaveLength(1);
    expect(p.profiles.rows[0].display_name).toBe("Carla");
    expect(p.profiles.rows[0].avatar_flag).toBe("ESP");
    expect(typeof p.profiles.rows[0].updated_at).toBe("number");
  });

  it("user B never sees A rows", async () => {
    const sharedOp = uuid();
    const sharedQh = uuid();
    await t.asUser(A);
    const ra = await push([
      mut("concept_progress", conceptPayload("PRT:capital", T0 + 20 * MIN, { fsrs_reps: 5 })),
      mut("unlocks", { key: "a-only", progress: 3, unlocked_at: T0 }, sharedOp),
      mut(
        "question_history",
        {
          conceptId: "PRT:capital",
          sessionId: "s-a",
          grade: 3,
          mode: "easy",
          direction: "c2k",
          fsrs_log: "{}",
          responseMs: 900,
          correct: true,
          answeredAt: T0 + 20 * MIN,
        },
        sharedQh,
      ),
    ]);
    expect(ra.rejected).toEqual([]);

    await t.asUser(B);
    const pb = await pull();
    for (const [entity, page] of Object.entries(pb)) {
      for (const row of page.rows) {
        expect(row.user_id ?? B, `${entity} leaked`).toBe(B);
        expect(row.conceptId === "PRT:capital" || row.key === "a-only", `${entity} leaked`).toBe(
          false,
        );
      }
    }
    for (const table of ["concept_progress", "unlocks", "question_history", "profiles"]) {
      const res = await t.db.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where ${table === "profiles" ? "id" : "user_id"} = $1`,
        [A],
      );
      expect(res.rows[0].n, table).toBe(0);
    }

    // B pushes with A's ids (same conceptId, same op_ids): only B's rows change.
    const rb = await push([
      mut(
        "concept_progress",
        conceptPayload("PRT:capital", T0 + 90 * MIN, { fsrs_reps: 1 }),
        sharedOp,
      ),
      mut(
        "question_history",
        {
          conceptId: "PRT:capital",
          sessionId: "s-b",
          grade: 1,
          mode: "hard",
          direction: "k2c",
          fsrs_log: null,
          responseMs: 100,
          correct: false,
          answeredAt: T0 + 90 * MIN,
        },
        sharedQh,
      ),
    ]);
    expect(rb.rejected).toEqual([]);
    expect(rb.accepted).toHaveLength(2);
    const pb2 = await pull();
    expect(pb2.question_history.rows.map((r) => r.sessionId)).toEqual(["s-b"]);

    await t.asUser(A);
    const pa = await pull();
    const aConcept = pa.concept_progress.rows.find((r) => r.conceptId === "PRT:capital")!;
    expect(aConcept.fsrs_reps).toBe(5);
    expect(aConcept.fsrs_last_review).toBe(T0 + 20 * MIN);
    expect(pa.question_history.rows.map((r) => r.sessionId)).toEqual(["s-a"]);
    expect(pa.unlocks.rows.map((r) => r.key)).toEqual(["a-only"]);
  });

  it("hardcore_exam_progress ids are per user", async () => {
    const id = `${A}_Europe`;
    const row = (uid: string) => ({
      id,
      user_id: uid,
      continent: "Europe",
      total_questions: 10,
      queue: "[]",
    });
    await t.asUser(B);
    await t.db.query(
      "insert into public.hardcore_exam_progress (id, user_id, continent, total_questions, queue) values ($1, $2, $3, $4, $5::jsonb)",
      Object.values(row(B)),
    );
    await t.asUser(A);
    await t.db.query(
      `insert into public.hardcore_exam_progress (id, user_id, continent, total_questions, queue) values ($1, $2, $3, $4, $5::jsonb)
       on conflict (user_id, id) do update set score = 7`,
      Object.values(row(A)),
    );
    const mine = await t.db.query<Row>("select user_id, score from public.hardcore_exam_progress");
    expect(mine.rows).toEqual([{ user_id: A, score: 0 }]);
    await t.asService();
    await expect(
      t.db.query(
        "insert into public.hardcore_exam_progress (id, user_id, continent, total_questions, queue) values ('x', null, 'Asia', 1, '[]')",
      ),
    ).rejects.toThrow();
  });

  it("learning_steps and question_history round trip", async () => {
    const user = uuid();
    await t.asUser(user);
    const qhOp = uuid();
    const concept = conceptPayload("JPN:capital", T0 + 2 * MIN, {
      fsrs_state: 1,
      fsrs_learning_steps: 1,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_due: T0 + 12 * MIN,
    });
    const qh = {
      op_id: qhOp,
      conceptId: "JPN:capital",
      sessionId: "sess-1",
      grade: 2,
      mode: "easy",
      direction: "countryToCap",
      fsrs_log: JSON.stringify({ grade: 3, due: "2026-11-01T10:12:00.000Z" }),
      responseMs: 1234,
      correct: true,
      answeredAt: T0 + 2 * MIN,
    };
    const r = await push([mut("concept_progress", concept), mut("question_history", qh, qhOp)]);
    expect(r.rejected).toEqual([]);

    const p = await pull();
    const c = p.concept_progress.rows[0];
    expect(c).toMatchObject({
      conceptId: "JPN:capital",
      iso3: "JPN",
      skill: "capital",
      fsrs_state: 1,
      fsrs_learning_steps: 1,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_due: T0 + 12 * MIN,
      fsrs_last_review: T0 + 2 * MIN,
      fsrs_reps: 3,
      fsrs_lapses: 0,
      version: 1,
    });
    expect(typeof c.updated_at).toBe("number");
    const h = p.question_history.rows;
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject(qh);
    expect(typeof h[0].updated_at).toBe("number");
    expect(p.question_history.cursor).toMatch(new RegExp(`^\\d+\\|${qhOp}$`));

    // Retrying the same question_history op is a no-op.
    const again = await push([mut("question_history", { ...qh, grade: 0 }, qhOp)]);
    expect(again.accepted).toEqual([qhOp]);
    const p2 = await pull();
    expect(p2.question_history.rows).toHaveLength(1);
    expect(p2.question_history.rows[0].grade).toBe(2);
  });

  it("daily_summary push is idempotent", async () => {
    const user = uuid();
    await t.asUser(user);
    const op = uuid();
    const day = { dateKey: "2026-11-05", reviewsCount: 10, correctCount: 8, timeSpentMs: 60_000 };
    await push([mut("daily_summary", day, op)]);
    await push([mut("daily_summary", day, op)]);
    await push([mut("daily_summary", day)]);
    await push([
      mut("daily_summary", { ...day, reviewsCount: 4, correctCount: 1, timeSpentMs: 5 }),
    ]);
    let p = await pull();
    expect(p.daily_summary.rows).toHaveLength(1);
    expect(p.daily_summary.rows[0]).toMatchObject(day);
    await push([mut("daily_summary", { ...day, reviewsCount: 12 })]);
    p = await pull();
    expect(p.daily_summary.rows[0]).toMatchObject({ ...day, reviewsCount: 12 });
  });

  it("challenge_attempts: natural-key duplicate with a new op_id is accepted, not looped", async () => {
    const user = uuid();
    await t.asUser(user);
    const attempt = {
      kind: "daily",
      period_key: "2026-11-05",
      question_index: 2,
      correct: true,
      ms: 800,
    };
    const r1 = await push([mut("challenge_attempts", attempt)]);
    const dup = mut("challenge_attempts", { ...attempt, correct: false });
    const r2 = await push([dup]);
    expect(r1.rejected).toEqual([]);
    expect(r2.rejected).toEqual([]);
    expect(r2.accepted).toEqual([dup.op_id]);
    const p = await pull();
    expect(p.challenge_attempts.rows).toHaveLength(1);
    expect(p.challenge_attempts.rows[0].correct).toBe(true);
  });

  it("delete_account removes only caller", async () => {
    const C = uuid();
    const D = uuid();
    for (const u of [C, D]) {
      await t.asUser(u);
      const r = await push([
        mut("concept_progress", conceptPayload("NOR:capital", T0)),
        mut("unlocks", { key: "u", progress: 1, unlocked_at: T0 }),
        mut("daily_summary", {
          dateKey: "2026-11-05",
          reviewsCount: 1,
          correctCount: 1,
          timeSpentMs: 1,
        }),
      ]);
      expect(r.rejected).toEqual([]);
      await t.db.query(
        "insert into public.hardcore_exam_progress (id, user_id, continent, total_questions, queue) values ('Europe', $1, 'Europe', 1, '[]')",
        [u],
      );
    }
    await t.asUser(C);
    await t.db.query("select public.delete_account()");

    await t.asService();
    const tables: [string, string][] = [
      ["auth.users", "id"],
      ["public.profiles", "id"],
      ["public.concept_progress", "user_id"],
      ["public.unlocks", "user_id"],
      ["public.daily_summary", "user_id"],
      ["public.hardcore_exam_progress", "user_id"],
    ];
    for (const [table, col] of tables) {
      const c = await t.db.query<{ n: number }>(
        `select count(*)::int as n from ${table} where ${col} = $1`,
        [C],
      );
      const d = await t.db.query<{ n: number }>(
        `select count(*)::int as n from ${table} where ${col} = $1`,
        [D],
      );
      expect(c.rows[0].n, `${table} for caller`).toBe(0);
      expect(d.rows[0].n, `${table} for other user`).toBe(1);
    }
  });

  it("anon cannot call sync_push", async () => {
    await t.asAnon();
    await expect(t.call("sync_push", { _mutations: [] })).rejects.toThrow(/permission denied/i);
    await expect(t.call("sync_pull", { _cursors: {}, _limit: 10 })).rejects.toThrow(
      /permission denied/i,
    );
    await expect(t.db.query("select public.delete_account()")).rejects.toThrow(
      /permission denied/i,
    );
    await expect(t.db.query("select * from public.concept_progress")).rejects.toThrow(
      /permission denied/i,
    );
    await t.asService();
  });

  it("authenticated with null uid gets 'unauthenticated'", async () => {
    await t.asService();
    await t.db.exec("set role authenticated");
    await expect(t.call("sync_push", { _mutations: [] })).rejects.toThrow(/unauthenticated/);
    await expect(t.call("sync_pull", { _cursors: {}, _limit: 10 })).rejects.toThrow(
      /unauthenticated/,
    );
    await expect(t.db.query("select public.delete_account()")).rejects.toThrow(/unauthenticated/);
    await t.asService();
  });
});

describe("baseline v2 under Supabase default privileges", () => {
  it("still exposes nothing to anon and no delete to authenticated", async () => {
    const t = await createTestDb(FILES, { supabaseDefaultGrants: true });
    await t.asAnon();
    await expect(t.call("sync_push", { _mutations: [] })).rejects.toThrow(/permission denied/i);
    await expect(t.db.query("select public.delete_account()")).rejects.toThrow(
      /permission denied/i,
    );
    await expect(t.db.query("select * from public.profiles")).rejects.toThrow(/permission denied/i);
    await t.asUser(A);
    await expect(t.db.query("delete from public.concept_progress")).rejects.toThrow(
      /permission denied/i,
    );
    await t.asService();
  }, 60_000);
});
