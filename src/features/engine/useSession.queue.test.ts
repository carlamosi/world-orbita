import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";

// In-memory stand-in for Dexie (fake-indexeddb is not installed).
const rows: ConceptProgressRow[] = [];
const recorded: { conceptId: string; correct: boolean }[] = [];
// Each Dexie read takes the next gate (if any) and waits on it, so tests can
// control the order in which concurrent reads resolve.
const gates: Promise<void>[] = [];

vi.mock("@/lib/db/orbita-db", () => ({
  db: () => ({
    concept_progress: {
      where: (field: string) => ({
        equals: (v: string) => ({
          toArray: async () => {
            const gate = gates.shift();
            if (gate) await gate;
            return rows.filter((r) => (r as unknown as Record<string, unknown>)[field] === v);
          },
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/db/progressRepo", () => ({
  recordConceptAttempt: vi.fn(
    async (_row: ConceptProgressRow, a: { conceptId: string; correct: boolean }) => {
      recorded.push({ conceptId: a.conceptId, correct: a.correct });
    },
  ),
}));
vi.mock("@/lib/db/repo", () => ({ recordSessionEnd: vi.fn(async () => {}) }));
vi.mock("@/lib/audio", () => ({ playAnswerSound: vi.fn() }));

import { buildPairs, createSessionStore } from "@/features/engine/useSession";
import { SPAIN_CCAA, SPAIN_PROVINCES } from "@/lib/spain";
import type { SpainEntity } from "@/lib/spain/types";
import { parseConceptId } from "@/lib/fsrs/concept";

const DAY = 86_400_000;
function row(conceptId: string, entityId: string, dueOffsetDays: number): ConceptProgressRow {
  const now = Date.now();
  return {
    conceptId,
    iso3: entityId,
    skill: "location",
    fsrs_state: State.Review as unknown as ConceptProgressRow["fsrs_state"],
    fsrs_stability: 5,
    fsrs_difficulty: 5,
    fsrs_due: now + dueOffsetDays * DAY,
    fsrs_reps: 3,
    fsrs_lapses: 0,
    fsrs_last_review: now - 6 * DAY,
    updated_at: now - 6 * DAY,
    version: 2,
    dirty: 0,
  } as ConceptProgressRow;
}

const findId = (id: string) => `spain:${id}:location:find`;

function provinceStore() {
  return createSessionStore<SpainEntity>({
    mode: "find",
    skill: "location",
    domain: "spain",
    dataset: SPAIN_PROVINCES,
    getId: (e) => e.id,
  });
}

function entityIds(cq: (ConceptProgressRow | null)[]) {
  return cq.map((c) => (c ? parseConceptId(c.conceptId).entityId : null));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("session queue pairs (FSRS-3, BUG-02)", () => {
  beforeEach(() => {
    rows.length = 0;
    recorded.length = 0;
    gates.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("provinces session with CCAA rows in the pool keeps queue[i] and conceptQueue[i] on the same entity", async () => {
    for (const c of SPAIN_CCAA.slice(0, 3)) rows.push(row(findId(c.id), c.id, -3));
    for (const p of SPAIN_PROVINCES.slice(0, 10)) rows.push(row(findId(p.id), p.id, -1));

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    const s = store.getState();

    expect(s.queue.length).toBeGreaterThan(0);
    expect(s.conceptQueue.length).toBe(s.queue.length);
    expect(entityIds(s.conceptQueue)).toEqual(s.queue.map((e) => e.id));

    const shown = s.queue[0]!;
    store.getState().submit(true);
    await flush();
    expect(recorded[0]?.conceptId).toBe(findId(shown.id));
  });

  it("pool is filtered by the active dataset ids: only CCAA rows still yields a provinces queue", async () => {
    for (const c of SPAIN_CCAA) rows.push(row(findId(c.id), c.id, -3));

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    const s = store.getState();

    const provinceIds = new Set(SPAIN_PROVINCES.map((p) => p.id));
    expect(s.queue.length).toBe(10);
    expect(s.conceptQueue.length).toBe(10);
    for (const id of entityIds(s.conceptQueue)) expect(provinceIds.has(id!)).toBe(true);
    expect(entityIds(s.conceptQueue)).toEqual(s.queue.map((e) => e.id));
  });

  it("conceptRows path drops a concept without a dataset item together with its item", async () => {
    const [p1, p2] = SPAIN_PROVINCES;
    const ccaa = SPAIN_CCAA[0]!;
    const conceptRows = [
      row(findId(ccaa.id), ccaa.id, -3),
      row(findId(p1!.id), p1!.id, -1),
      row(findId(p2!.id), p2!.id, -1),
    ];

    const store = provinceStore();
    await store.getState().start({ conceptRows });
    const s = store.getState();

    expect(s.queue.map((e) => e.id)).toEqual([p1!.id, p2!.id]);
    expect(entityIds(s.conceptQueue)).toEqual([p1!.id, p2!.id]);
  });

  it("buildPairs drops a planned concept with no item and keeps the rest in order", () => {
    const lookupMap = new Map(SPAIN_PROVINCES.map((p) => [p.id, p]));
    const [p1, p2] = SPAIN_PROVINCES;
    const planned = [
      row(findId(p1!.id), p1!.id, 0),
      row(findId("ES-AN"), "ES-AN", 0),
      row(findId(p2!.id), p2!.id, 0),
    ];

    const pairs = buildPairs(planned, (c) => lookupMap.get(parseConceptId(c.conceptId).entityId));

    expect(pairs.map((p) => p.item.id)).toEqual([p1!.id, p2!.id]);
    expect(pairs.map((p) => p.conceptId)).toEqual([findId(p1!.id), findId(p2!.id)]);
    expect(pairs.map((p) => p.concept.conceptId)).toEqual([findId(p1!.id), findId(p2!.id)]);
  });

  it("wrong answers re-queue the item and its concept together", async () => {
    for (const p of SPAIN_PROVINCES.slice(0, 10)) rows.push(row(findId(p.id), p.id, -1));
    const store = provinceStore();
    await store.getState().start({ subMode: "find" });

    store.getState().submit(false);
    const s = store.getState();
    expect(s.queue.length).toBe(11);
    expect(s.conceptQueue.length).toBe(11);
    expect(entityIds(s.conceptQueue)).toEqual(s.queue.map((e) => e.id));
  });

  describe("submit guard on a mismatched pair", () => {
    async function mismatchedStore() {
      for (const p of SPAIN_PROVINCES.slice(0, 10)) rows.push(row(findId(p.id), p.id, -1));
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const s = store.getState();
      const bad = row(findId("ES-AN"), "ES-AN", -3);
      const pairs = [...s.pairs];
      pairs[0] = { ...pairs[0]!, conceptId: bad.conceptId, concept: bad };
      store.setState({
        pairs,
        queue: pairs.map((p) => p.item),
        conceptQueue: pairs.map((p) => p.concept),
      });
      return store;
    }

    it("throws in dev builds", async () => {
      const store = await mismatchedStore();
      expect(() => store.getState().submit(true)).toThrow(/mismatch/i);
      await flush();
      expect(recorded).toEqual([]);
    });

    it("skips grading and logs once in prod builds", async () => {
      vi.stubEnv("DEV", false);
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = await mismatchedStore();
      store.getState().submit(true);
      await flush();
      expect(recorded).toEqual([]);
      expect(store.getState().answerState).toBe("correct");

      // A second mismatch does not log again.
      store.setState({ answerState: "idle" });
      store.getState().submit(true);
      await flush();
      expect(recorded).toEqual([]);
      expect(err).toHaveBeenCalledTimes(1);
    });
  });

  it("a stale concurrent start() is ignored: the later call's session wins and grades go to its concept", async () => {
    let releaseA!: () => void;
    let releaseB!: () => void;
    gates.push(new Promise<void>((r) => (releaseA = r)));
    gates.push(new Promise<void>((r) => (releaseB = r)));

    const store = provinceStore();
    const a = store.getState().start({ subMode: "A" });
    const b = store.getState().start({ subMode: "B" });

    // B's read resolves first, then A's (A is the older, stale call).
    releaseB();
    await b;
    releaseA();
    await a;

    const s = store.getState();
    expect(s.loading).toBe(false);
    expect(s.queue.length).toBeGreaterThan(0);
    for (const c of s.conceptQueue) expect(c!.conceptId.endsWith(":B")).toBe(true);

    store.getState().submit(true);
    await flush();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.conceptId.endsWith(":B")).toBe(true);
  });
});
