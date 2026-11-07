// @vitest-environment jsdom
// v2 contract: every date in a push payload is a numeric epoch ms, concept
// rows carry fsrs_learning_steps, and never-reviewed concepts are not queued.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { State } from "ts-fsrs";
import { createMemDb, type MemDb } from "@/test/memoryDexie";
import type { ConceptProgressRow, QuestionHistoryRow, OutboxRow } from "@/lib/db/orbita-db";

let mem: MemDb = createMemDb();
const created: Record<string, MemDb> = {};
const enqueued: { entity: string; payload: Record<string, unknown> }[] = [];

vi.mock("@/lib/db/orbita-db", () => ({
  db: () => mem,
  isBrowser: () => true,
  ALL_SKILLS: ["location", "name", "flag", "capital"],
  createOrbitaDb: (name: string) => (created[name] ??= createMemDb()),
}));
vi.mock("@/lib/sync/queue", async (orig) => ({
  ...(await orig<typeof import("@/lib/sync/queue")>()),
  enqueue: (a: { entity: string; payload: Record<string, unknown> }) => enqueued.push(a),
}));

import { updateSkillProgress, recordSessionEnd } from "@/lib/db/repo";
import { recordConceptAttempt } from "@/lib/db/progressRepo";
import { conceptProgressPayload } from "./payloads";

const T = Date.UTC(2026, 10, 5, 10, 0, 0);

function concept(extra: Partial<ConceptProgressRow> = {}): ConceptProgressRow {
  return {
    conceptId: "FRA:capital:countryToCap",
    iso3: "FRA",
    skill: "capital",
    fsrs_state: State.Learning,
    fsrs_stability: 2,
    fsrs_difficulty: 5,
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

function history(op_id = crypto.randomUUID()): QuestionHistoryRow {
  return {
    op_id,
    conceptId: "FRA:capital:countryToCap",
    sessionId: "s1",
    grade: 3,
    mode: "easy",
    direction: "country->capital",
    responseMs: 1200,
    correct: true,
    answeredAt: T,
  };
}

const isMs = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 946_684_800_000;

beforeEach(() => {
  mem = createMemDb();
  enqueued.length = 0;
  for (const k of Object.keys(created)) delete created[k];
});

describe("repo.ts enqueue sites send epoch ms", () => {
  it("country_progress last_seen_at is numeric", async () => {
    await updateSkillProgress("FRA", "capital", () => ({
      confidence: 1,
      timesRight: 1,
      timesWrong: 0,
      streak: 1,
      lastSeenAt: T,
    }));
    const cp = enqueued.find((e) => e.entity === "country_progress");
    expect(cp?.payload.last_seen_at).toBe(T);
  });

  it("sessions_log, unlocks and daily_streak dates are numeric", async () => {
    await recordSessionEnd({
      mode: "capital",
      skill: "capital",
      score: 10,
      totalQuestions: 500,
      correct: 400,
      wrong: 100,
      bestCombo: 3,
      durationMs: 60_000,
      createdAt: T,
    });
    const s = enqueued.find((e) => e.entity === "sessions_log")!;
    expect(s.payload.started_at).toBe(T - 60_000);
    expect(s.payload.ended_at).toBe(T);
    const streak = enqueued.find((e) => e.entity === "daily_streak")!;
    expect(streak.payload.last_active_at).toBe(T);
    for (const u of enqueued.filter((e) => e.entity === "unlocks")) {
      const v = u.payload.unlocked_at;
      expect(v === null || isMs(v)).toBe(true);
    }
  });
});

describe("progressRepo.recordConceptAttempt", () => {
  it("queues fsrs_learning_steps with the concept payload", async () => {
    await recordConceptAttempt(concept(), history());
    const out = (await mem.outbox.toArray()) as unknown as OutboxRow[];
    const cp = out.find((o) => o.entity === "concept_progress")!;
    expect(cp.payload.fsrs_learning_steps).toBe(1);
    expect(isMs(cp.payload.fsrs_last_review)).toBe(true);
    expect(isMs(cp.payload.fsrs_due)).toBe(true);
  });

  it("stamps client_id on both rows and keeps the history op_id", async () => {
    const h = history();
    await recordConceptAttempt(concept(), h);
    const out = (await mem.outbox.toArray()) as unknown as OutboxRow[];
    expect(out).toHaveLength(2);
    for (const o of out) expect(typeof o.payload.client_id).toBe("string");
    expect(out.find((o) => o.entity === "question_history")!.op_id).toBe(h.op_id);
  });

  it("never queues a concept row with fsrs_last_review <= 0 and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordConceptAttempt(concept({ fsrs_last_review: 0 }), history());
    await recordConceptAttempt(
      concept({ conceptId: "ESP:capital:countryToCap", fsrs_last_review: 0 }),
      history(),
    );
    const out = (await mem.outbox.toArray()) as unknown as OutboxRow[];
    expect(out.filter((o) => o.entity === "concept_progress")).toHaveLength(0);
    // the history row is still queued
    expect(out.filter((o) => o.entity === "question_history")).toHaveLength(2);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("fsrs_last_review"))).toHaveLength(
      1,
    );
    warn.mockRestore();
  });
});

describe("conceptProgressPayload", () => {
  it("returns null for never-reviewed rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(conceptProgressPayload(concept({ fsrs_last_review: -5 }))).toBeNull();
    warn.mockRestore();
  });
  it("defaults missing FSRS day/step fields to numbers", () => {
    const p = conceptProgressPayload(
      concept({
        fsrs_elapsed_days: undefined,
        fsrs_scheduled_days: undefined,
        fsrs_learning_steps: undefined,
      }),
    )!;
    expect(p.fsrs_elapsed_days).toBe(0);
    expect(p.fsrs_scheduled_days).toBe(0);
    // Learning row with a 10 min gap, no stored step -> derived step 1
    expect(p.fsrs_learning_steps).toBe(1);
  });
});
