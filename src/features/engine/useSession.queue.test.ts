import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";

// In-memory stand-in for Dexie (fake-indexeddb is not installed).
const rows: ConceptProgressRow[] = [];
const recorded: { conceptId: string; correct: boolean }[] = [];
// Each Dexie read takes the next gate (if any) and waits on it, so tests can
// control the order in which concurrent reads resolve.
const gates: Promise<void>[] = [];
// In-memory sync_meta (key/value), as in orbita-db.ts.
const meta = new Map<string, string>();

vi.mock("@/lib/db/orbita-db", () => ({
  db: () => ({
    sync_meta: {
      get: async (key: string) => (meta.has(key) ? { key, value: meta.get(key)! } : undefined),
      put: async (r: { key: string; value: string }) => {
        meta.set(r.key, r.value);
        return r.key;
      },
    },
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
import { COUNTRIES } from "@/lib/countries";
import type { SpainEntity } from "@/lib/spain/types";
import { parseConceptId } from "@/lib/fsrs/concept";
import { getRetrievability } from "@/lib/fsrs/adapter";
import { MAX_NEW_PER_DAY, newCardsKey } from "@/features/engine/newCardLimit";

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
    meta.clear();
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

function learningRow(conceptId: string, entityId: string, dueInMs: number): ConceptProgressRow {
  const now = Date.now();
  return {
    ...row(conceptId, entityId, 0),
    fsrs_state: State.Learning as unknown as ConceptProgressRow["fsrs_state"],
    fsrs_stability: 1,
    fsrs_difficulty: 5,
    fsrs_due: now + dueInMs,
    fsrs_reps: 1,
    fsrs_last_review: now,
    updated_at: now,
  } as ConceptProgressRow;
}

/** Today's counter key; the default bucket is Spain provinces location:find. */
const todayKey = (bucket = "spain:location:find") => newCardsKey(bucket, Date.now());

describe("new cards under a daily cap and empty state (FSRS-2)", () => {
  beforeEach(() => {
    rows.length = 0;
    recorded.length = 0;
    gates.length = 0;
    meta.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("10 rows in Learning due in 10 min: the queue is filled with new concepts up to sessionSize", async () => {
    const seen = SPAIN_PROVINCES.slice(0, 10);
    for (const p of seen) rows.push(learningRow(findId(p.id), p.id, 10 * 60_000));

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    const s = store.getState();

    expect(s.queue).toHaveLength(10);
    const seenIds = new Set(seen.map((p) => p.id));
    for (const e of s.queue) expect(seenIds.has(e.id)).toBe(false);
    expect(entityIds(s.conceptQueue)).toEqual(s.queue.map((e) => e.id));
    for (const c of s.conceptQueue) expect(c!.fsrs_state).toBe(State.New);
    expect(s.status).not.toBe("empty");
  });

  it("new concepts only fill what today's cap leaves", async () => {
    meta.set(todayKey(), String(MAX_NEW_PER_DAY - 3));
    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    expect(store.getState().queue).toHaveLength(3);
  });

  it("daily cap exhausted and nothing due: status is 'empty' and the queue is []", async () => {
    meta.set(todayKey(), String(MAX_NEW_PER_DAY));
    for (const p of SPAIN_PROVINCES.slice(0, 10)) {
      rows.push(learningRow(findId(p.id), p.id, 10 * 60_000));
    }

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    const s = store.getState();

    expect(s.status).toBe("empty");
    expect(s.emptyReason).toBe("limit");
    expect(s.hasSeen).toBe(true);
    expect(s.queue).toEqual([]);
    expect(s.pairs).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it("every entity seen, none due, budget left: empty with reason 'seenAll'", async () => {
    for (const p of SPAIN_PROVINCES) rows.push(learningRow(findId(p.id), p.id, 10 * 60_000));
    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    const s = store.getState();
    expect(s.status).toBe("empty");
    expect(s.emptyReason).toBe("seenAll");
    expect(s.hasSeen).toBe(true);
  });

  it("a mixed session puts due rows first, then new seeds, up to sessionSize", async () => {
    const due = SPAIN_PROVINCES.slice(0, 4);
    for (const p of due) rows.push(row(findId(p.id), p.id, -1));

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    const s = store.getState();

    expect(s.queue).toHaveLength(10);
    expect(new Set(s.queue.slice(0, 4).map((e) => e.id))).toEqual(new Set(due.map((p) => p.id)));
    for (const c of s.conceptQueue.slice(0, 4)) expect(c!.fsrs_state).toBe(State.Review);
    for (const c of s.conceptQueue.slice(4)) expect(c!.fsrs_state).toBe(State.New);
    expect(entityIds(s.conceptQueue)).toEqual(s.queue.map((e) => e.id));
  });

  it("grading a world location:find and a Spain find new card increments two different keys", async () => {
    const world = createSessionStore({ mode: "find", skill: "location" });
    await world.getState().start({ subMode: "find" });
    expect(world.getState().conceptQueue[0]!.fsrs_state).toBe(State.New);
    world.getState().submit(true);
    await flush();

    const spain = provinceStore();
    await spain.getState().start({ subMode: "find" });
    spain.getState().submit(true);
    await flush();

    expect(meta.get(todayKey("world:location:find"))).toBe("1");
    expect(meta.get(todayKey("spain:location:find"))).toBe("1");
  });

  it("the cap used up for flag:flagToCountry does not block capital:countryToCap", async () => {
    meta.set(todayKey("world:flag:flagToCountry"), String(MAX_NEW_PER_DAY));

    const flags = createSessionStore({ mode: "flag", skill: "flag" });
    await flags.getState().start({ subMode: "flagToCountry" });
    expect(flags.getState().status).toBe("empty");
    expect(flags.getState().emptyReason).toBe("limit");
    expect(flags.getState().hasSeen).toBe(false);

    const capitals = createSessionStore({ mode: "capital", skill: "capital" });
    await capitals.getState().start({ subMode: "countryToCap" });
    expect(capitals.getState().queue).toHaveLength(10);
    expect(capitals.getState().status).toBe("active");
    const ids = new Set(COUNTRIES.map((c) => c.iso3));
    for (const e of capitals.getState().queue) expect(ids.has(e.iso3)).toBe(true);
  });

  it("grading a new concept increments today's counter once; grading a seen one does not", async () => {
    const [p1] = SPAIN_PROVINCES;
    rows.push(row(findId(p1!.id), p1!.id, -1)); // seen and due: planner puts it first

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    let s = store.getState();
    expect(s.queue[0]!.id).toBe(p1!.id);

    // Seen concept: no increment.
    s.submit(true);
    await flush();
    expect(meta.get(todayKey())).toBeUndefined();

    // New concept: one increment, even though the wrong answer re-queues it.
    store.getState().next();
    s = store.getState();
    expect(s.conceptQueue[s.index]!.fsrs_state).toBe(State.New);
    const newId = s.conceptQueue[s.index]!.conceptId;
    s.submit(false);
    await flush();
    expect(meta.get(todayKey())).toBe("1");

    // Answering the re-queued retry of the same concept does not count again.
    const after = store.getState();
    const retryIdx = after.conceptQueue.findIndex(
      (c, i) => i > after.index && c!.conceptId === newId,
    );
    expect(retryIdx).toBeGreaterThan(0);
    store.setState({ index: retryIdx, answerState: "idle" });
    store.getState().submit(true);
    await flush();
    expect(meta.get(todayKey())).toBe("1");
  });

  describe("only planner sessions spend the new-card cap", () => {
    const ccaaStore = () =>
      createSessionStore<SpainEntity>({
        mode: "find",
        skill: "location",
        domain: "spain",
        dataset: SPAIN_CCAA,
        getId: (e) => e.id,
      });

    it("grading New cards in a Complete session does not increment the counter", async () => {
      const store = ccaaStore();
      await store.getState().start({ items: [...SPAIN_CCAA], subMode: "find" });
      expect(store.getState().countsTowardNewCap).toBe(false);
      expect(store.getState().conceptQueue[0]!.fsrs_state).toBe(State.New);
      store.getState().submit(true);
      await flush();
      expect(recorded).toHaveLength(1);
      expect(meta.get(todayKey())).toBeUndefined();
    });

    it("grading a New card in a planner session increments the counter", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      expect(store.getState().countsTowardNewCap).toBe(true);
      store.getState().submit(true);
      await flush();
      expect(meta.get(todayKey())).toBe("1");
    });

    it("grading in a Review (conceptRows) session does not increment the counter", async () => {
      const store = provinceStore();
      const [p1] = SPAIN_PROVINCES;
      const newRow = { ...row(findId(p1!.id), p1!.id, -1), fsrs_state: State.New } as unknown as ConceptProgressRow;
      await store.getState().start({ conceptRows: [newRow] });
      expect(store.getState().countsTowardNewCap).toBe(false);
      store.getState().submit(true);
      await flush();
      expect(meta.get(todayKey())).toBeUndefined();
    });

    it("grading in startPractice() does not increment the counter, and the flag resets after a planner start", async () => {
      const [p1] = SPAIN_PROVINCES;
      rows.push(row(findId(p1!.id), p1!.id, 3));
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      expect(store.getState().countsTowardNewCap).toBe(true);
      await store.getState().startPractice();
      expect(store.getState().countsTowardNewCap).toBe(false);
      store.getState().submit(true);
      await flush();
      expect(meta.get(todayKey())).toBeUndefined();
    });

    it("a graded Complete CCAA session still leaves new province cards on offer", async () => {
      const ccaa = ccaaStore();
      await ccaa.getState().start({ items: [...SPAIN_CCAA], subMode: "find" });
      for (let i = 0; i < SPAIN_CCAA.length; i++) {
        ccaa.getState().submit(true);
        await flush();
        ccaa.getState().next();
      }
      expect(meta.get(todayKey())).toBeUndefined();

      const provinces = provinceStore();
      await provinces.getState().start({ subMode: "find" });
      expect(provinces.getState().status).toBe("active");
      expect(provinces.getState().queue.length).toBeGreaterThan(0);
      expect(provinces.getState().conceptQueue[0]!.fsrs_state).toBe(State.New);
    });
  });

  it("startPractice() returns only seen concepts, lowest retrievability first", async () => {
    meta.set(todayKey(), String(MAX_NEW_PER_DAY));
    const now = Date.now();
    // Review rows not yet due, with different stability: lower stability = lower R.
    const stab = [20, 2, 50, 8];
    SPAIN_PROVINCES.slice(0, 4).forEach((p, i) => {
      rows.push({
        ...row(findId(p.id), p.id, 3),
        fsrs_stability: stab[i]!,
        fsrs_last_review: now - 2 * DAY,
      } as ConceptProgressRow);
    });
    // A persisted row still in New must not be practised.
    const p5 = SPAIN_PROVINCES[4]!;
    rows.push({
      ...row(findId(p5.id), p5.id, 0),
      fsrs_state: State.New as unknown as ConceptProgressRow["fsrs_state"],
    } as ConceptProgressRow);

    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    expect(store.getState().status).toBe("empty");

    await store.getState().startPractice();
    const s = store.getState();
    const expected = rows
      .filter((r) => (r.fsrs_state as unknown) !== State.New)
      .sort((a, b) => getRetrievability(a) - getRetrievability(b))
      .map((r) => parseConceptId(r.conceptId).entityId);

    expect(expected).toHaveLength(4);
    expect(s.status).not.toBe("empty");
    expect(entityIds(s.conceptQueue)).toEqual(expected);
    expect(s.queue.map((e) => e.id)).toEqual(expected);

    // Practice grades are recorded normally.
    s.submit(true);
    await flush();
    expect(recorded[0]?.conceptId).toBe(findId(expected[0]!));
  });

  it("the counter key uses the device's local day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T23:30:00Z"));
    expect(newCardsKey("world:location:find", Date.now(), "Europe/Madrid")).toBe(
      "new_cards_2026-11-06_world:location:find",
    );
    expect(newCardsKey("world:location:find", Date.now(), "UTC")).toBe(
      "new_cards_2026-11-05_world:location:find",
    );
  });

  describe("honest grades and guards (Task 17)", () => {
    const first = () => SPAIN_PROVINCES[0]!;

    it("submit does not freeze when FSRS processing throws", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      // A row whose fields blow up when read, standing in for any FSRS failure.
      const bad = { ...store.getState().pairs[0]!.concept };
      Object.defineProperty(bad, "fsrs_stability", {
        get() {
          throw new Error("boom");
        },
      });
      store.setState({
        pairs: store.getState().pairs.map((x, i) => (i === 0 ? { ...x, concept: bad } : x)),
      });
      expect(() => store.getState().submit(true)).not.toThrow();
      expect(store.getState().answerState).toBe("correct");
      expect(err).toHaveBeenCalled();
      err.mockRestore();
    });

    it("Practice anyway skips Learning cards that are not due yet", async () => {
      meta.set(todayKey(), String(MAX_NEW_PER_DAY));
      const now = Date.now();
      const [p1, p2] = SPAIN_PROVINCES;
      rows.push({
        ...row(findId(p1!.id), p1!.id, 3),
        fsrs_state: State.Learning as never,
        fsrs_due: now + 5 * 60_000,
      } as ConceptProgressRow);
      rows.push(row(findId(p2!.id), p2!.id, 3)); // Review, not due: allowed
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      await store.getState().startPractice();
      expect(store.getState().queue.map((e) => e.id)).toEqual([p2!.id]);
    });

    it("a double next() does not skip a question", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      store.getState().submit(true);
      store.getState().next();
      store.getState().next();
      expect(store.getState().index).toBe(1);
    });

    it("next({ allowIdle: true }) still skips an unanswered question", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      store.getState().next({ allowIdle: true });
      expect(store.getState().index).toBe(1);
    });

    it("a fuzzy-accepted answer is graded Hard, an exact one Good", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      store.getState().submit(true, { retrievalMode: "hard", softCorrect: true });
      const soft = store.getState().conceptQueue[0]!;
      const hardStab = soft.fsrs_stability!;
      const store2 = provinceStore();
      await store2.getState().start({ subMode: "find" });
      store2.getState().submit(true, { retrievalMode: "hard" });
      expect(store2.getState().conceptQueue[0]!.fsrs_stability!).toBeGreaterThan(hardStab);
    });
  });
});
