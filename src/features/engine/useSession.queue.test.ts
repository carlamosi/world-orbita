import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";

// In-memory stand-in for Dexie (fake-indexeddb is not installed).
const rows: ConceptProgressRow[] = [];
const recorded: { conceptId: string; correct: boolean; reps?: number; stateBefore?: number }[] = [];
// Each Dexie read takes the next gate (if any) and waits on it, so tests can
// control the order in which concurrent reads resolve.
const gates: Promise<void>[] = [];
// In-memory sync_meta (key/value), as in orbita-db.ts.
const meta = new Map<string, string>();
// Recent first tries, newest first, as question_history returns them.
const history: { correct: boolean }[] = [];

vi.mock("@/lib/db/orbita-db", () => ({
  db: () => ({
    sync_meta: {
      get: async (key: string) => (meta.has(key) ? { key, value: meta.get(key)! } : undefined),
      put: async (r: { key: string; value: string }) => {
        meta.set(r.key, r.value);
        return r.key;
      },
    },
    question_history: {
      orderBy: () => ({ reverse: () => ({ limit: (n: number) => ({ toArray: async () => history.slice(0, n) }) }) }),
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
    async (row: ConceptProgressRow, a: { conceptId: string; correct: boolean }) => {
      recorded.push({ conceptId: a.conceptId, correct: a.correct, reps: row.fsrs_reps });
    },
  ),
}));
vi.mock("@/lib/db/repo", () => ({ recordSessionEnd: vi.fn(async () => {}) }));
vi.mock("@/lib/audio", () => ({ playAnswerSound: vi.fn() }));
let failReview = false;
vi.mock("@/lib/fsrs/adapter", async (orig) => {
  const actual = await orig<typeof import("@/lib/fsrs/adapter")>();
  return {
    ...actual,
    processReview: (...a: Parameters<typeof actual.processReview>) => {
      if (failReview) throw new Error("boom");
      return actual.processReview(...a);
    },
  };
});

import { buildPairs, createSessionStore, recognitionThenRecall } from "@/features/engine/useSession";
import { SPAIN_CCAA, SPAIN_PROVINCES } from "@/lib/spain";
import { COUNTRIES } from "@/lib/countries";
import type { SpainEntity } from "@/lib/spain/types";
import { parseConceptId } from "@/lib/fsrs/concept";
import { getRetrievability } from "@/lib/fsrs/adapter";

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

describe("new cards and empty state (FSRS-2)", () => {
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

  it("there is no daily new-card cap: after a full session of new cards, the next one is new cards again", async () => {
    const store = provinceStore();
    for (let round = 0; round < 3; round++) {
      await store.getState().start({ subMode: "find" });
      const n = store.getState().queue.length;
      expect(n).toBe(10);
      for (let i = 0; i < n; i++) {
        store.getState().submit(true);
        store.getState().next();
      }
      await flush();
      // Persist this round as seen (Learning, not yet due) so the next start must seed new entities.
      rows.push(...recorded.splice(0).map((r) => learningRow(r.conceptId, parseConceptId(r.conceptId).entityId, 10 * 60_000)));
    }
  });

  it("a mixed capitals session seeds both directions, one slot per country, and skips other subModes", async () => {
    const [a, b] = COUNTRIES;
    // a: country→capital learned, so only capital→country is new. b: a locator row must not count.
    rows.push({ ...row(`${a!.iso3}:capital:countryToCap`, a!.iso3, 5), skill: "capital" } as ConceptProgressRow);
    rows.push({ ...row(`${b!.iso3}:capital:locator`, b!.iso3, 5), skill: "capital" } as ConceptProgressRow);
    const store = createSessionStore({
      mode: "capital",
      skill: "capital",
      mixedSubModes: ["countryToCap", "capToCountry"],
    });
    const dirs = new Set<string>();
    for (let i = 0; i < 5; i++) {
      await store.getState().start({ subMode: "mixed" });
      const ids = store.getState().conceptQueue.map((c) => c!.conceptId);
      expect(ids).toHaveLength(10);
      expect(new Set(ids.map((id) => parseConceptId(id).entityId)).size).toBe(10);
      for (const id of ids) {
        const sm = parseConceptId(id).subMode!;
        expect(["countryToCap", "capToCountry"]).toContain(sm);
        dirs.add(sm);
      }
      expect(ids).not.toContain(`${a!.iso3}:capital:countryToCap`);
    }
    expect(dirs).toEqual(new Set(["countryToCap", "capToCountry"]));
  });

  it("a low recent success rate brings fewer new cards; a high one a full session", async () => {
    history.length = 0;
    history.push(...Array.from({ length: 30 }, (_, i) => ({ correct: i % 2 === 0 })));
    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    expect(store.getState().queue).toHaveLength(3);

    history.length = 0;
    history.push(...Array.from({ length: 30 }, () => ({ correct: true })));
    await store.getState().start({ subMode: "find" });
    expect(store.getState().queue).toHaveLength(10);
    history.length = 0;
  });

  it("a fast wrong pick stays on screen longer than a skip", async () => {
    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    store.getState().submit(false, { chosen: "Somewhere else" });
    expect(store.getState().missDelayMs).toBe(3500);
    store.getState().next();
    store.getState().reveal();
    expect(store.getState().missDelayMs).toBe(2500);
  });

  describe("contrast question after a confusion", () => {
    it("picking another real entity queues it two cards later, keeping its saved progress", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const s0 = store.getState();
      const target = s0.queue[0]!;
      // An entity not in this session, with saved progress that must not be reset.
      const inSession = new Set(s0.queue.map((e) => e.id));
      const picked = SPAIN_PROVINCES.find((p) => !inSession.has(p.id))!;
      const saved = row(findId(picked.id), picked.id, 5);
      rows.push(saved);
      await store.getState().start({ subMode: "find" });
      const s1 = store.getState();
      expect(s1.queue[0]!.id).toBe(target.id);
      const cards = s1.cardCount;

      s1.submit(false, { chosen: picked.name, chosenId: picked.id });
      const s2 = store.getState();
      expect(s2.queue[3]!.id).toBe(picked.id);
      expect(s2.conceptQueue[3]!.conceptId).toBe(findId(picked.id));
      expect(s2.conceptQueue[3]!.fsrs_stability).toBe(saved.fsrs_stability);
      expect(s2.cardCount).toBe(cards + 1);
    });

    it("a right answer or a skip adds no contrast", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const n = store.getState().queue.length;
      const other = SPAIN_PROVINCES.find((p) => p.id !== store.getState().queue[0]!.id)!;
      store.getState().submit(true, { chosenId: other.id });
      expect(store.getState().queue).toHaveLength(n);
      store.getState().next();
      store.getState().reveal();
      expect(store.getState().queue).toHaveLength(n + 1); // only the retry of the miss
    });

    it("never in a Due Today session (its rows are not all loaded)", async () => {
      const [p1, p2] = SPAIN_PROVINCES;
      const store = provinceStore();
      await store.getState().start({ conceptRows: [row(findId(p1!.id), p1!.id, -1)] });
      store.getState().submit(false, { chosenId: p2!.id });
      expect(store.getState().queue.map((e) => e.id)).not.toContain(p2!.id);
    });

    it("at most three per session", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const inSession = new Set(store.getState().queue.map((e) => e.id));
      const outsiders = SPAIN_PROVINCES.filter((p) => !inSession.has(p.id)).slice(0, 5);
      for (const o of outsiders) {
        store.getState().submit(false, { chosenId: o.id });
        store.getState().next();
      }
      // Distinct countries: a missed contrast question gets its own retry slot.
      const added = new Set(
        store.getState().queue.filter((e) => outsiders.some((o) => o.id === e.id)).map((e) => e.id),
      );
      expect(added.size).toBe(3);
    });
  });

  it("a mixed session with a pick rule asks recall once recognition graduated, without waiting days", async () => {
    const [a, b, c] = COUNTRIES;
    // a: recognition graduated today (two right in a row), not due: no waiting days.
    // b: recognition still in its learning steps. c: never seen.
    rows.push({ ...row(`${a!.iso3}:name:name`, a!.iso3, 0.5), skill: "name", fsrs_stability: 2 } as ConceptProgressRow);
    rows.push({
      ...learningRow(`${b!.iso3}:name:name`, b!.iso3, 10 * 60_000),
      skill: "name",
    } as ConceptProgressRow);
    const store = createSessionStore({
      mode: "name",
      skill: "name",
      dataset: [a!, b!, c!],
      mixedSubModes: ["name", "nameType"],
      mixedPick: recognitionThenRecall,
    });
    await store.getState().start({ subMode: "mixed" });
    const ids = store.getState().conceptQueue.map((x) => x!.conceptId).sort();
    // a moves on to recall; b waits until its recognition is due; c starts as recognition.
    expect(ids).toEqual([`${a!.iso3}:name:nameType`, `${c!.iso3}:name:name`].sort());
  });

  describe("spaced-repetition invariants over whole sessions", () => {
    /**
     * Plays a session to the end: misses with a pick of another entity (some in the
     * session, some not), skips and right answers. Returns what was shown when each
     * grade was written.
     */
    async function playSession(store: ReturnType<typeof provinceStore>) {
      const shownAtGrade: string[] = [];
      const outsiders = SPAIN_PROVINCES.filter(
        (p) => !store.getState().queue.some((e) => e.id === p.id),
      );
      let step = 0;
      for (let guard = 0; guard < 200 && store.getState().endedAt === null; guard++) {
        const st = store.getState();
        const shown = st.queue[st.index]!;
        const before = recorded.length;
        const kind = step++ % 4;
        if (kind === 0) {
          // Confusion with an entity outside the session.
          st.submit(false, { chosen: "x", chosenId: outsiders[step % outsiders.length]!.id });
        } else if (kind === 1) {
          // Confusion with an entity already in this session.
          const other = st.queue.find((e) => e.id !== shown.id)!;
          st.submit(false, { chosen: other.name, chosenId: other.id });
        } else if (kind === 2) {
          st.reveal();
        } else {
          st.submit(true);
        }
        if (recorded.length > before) shownAtGrade.push(shown.id);
        store.getState().next();
      }
      expect(store.getState().endedAt).not.toBeNull();
      return shownAtGrade;
    }

    it("each card is graded once per session, on the entity shown", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const shownAtGrade = await playSession(store);

      const ids = recorded.map((r) => r.conceptId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.map((id) => parseConceptId(id).entityId)).toEqual(shownAtGrade);
    });

    it("first-try correct never exceeds the distinct cards of the session", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      await playSession(store);
      const st = store.getState();
      expect(st.firstTryCorrect).toBeLessThanOrEqual(st.cardCount);
      expect(st.cardCount).toBe(new Set(st.pairs.map((p) => p.conceptId)).size);
    });

    it("no contrast for an entity already asked this session (it would count twice)", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const first = store.getState().queue[0]!;
      store.getState().submit(true);
      store.getState().next();
      const n = store.getState().queue.length;
      store.getState().submit(false, { chosenId: first.id });
      // Only the retry of the miss is added.
      expect(store.getState().queue).toHaveLength(n + 1);
      expect(store.getState().queue.filter((e) => e.id === first.id)).toHaveLength(1);
    });

    it("a contrast question about a learned entity continues its progress, never resets it", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      const inSession = new Set(store.getState().queue.map((e) => e.id));
      const learned = SPAIN_PROVINCES.find((p) => !inSession.has(p.id))!;
      rows.push({ ...row(findId(learned.id), learned.id, 5), fsrs_reps: 7 } as ConceptProgressRow);
      await store.getState().start({ subMode: "find" });
      store.getState().submit(false, { chosenId: learned.id });
      // Answer up to and including the contrast slot.
      for (let i = 0; i < 4; i++) {
        store.getState().next();
        if (store.getState().queue[store.getState().index]?.id === learned.id) {
          store.getState().submit(true);
          break;
        }
        store.getState().submit(true);
      }
      const graded = recorded.find((r) => r.conceptId === findId(learned.id));
      expect(graded?.reps).toBe(8);
    });
  });

  it("marks options cards whose typed sibling was answered, so pages ask them typed", async () => {
    const [a, b] = COUNTRIES;
    rows.push({ ...row(`${a!.iso3}:flag:flagToCountry`, a!.iso3, -1), skill: "flag" } as ConceptProgressRow);
    rows.push({ ...row(`${a!.iso3}:flag:flagToType`, a!.iso3, 3), skill: "flag" } as ConceptProgressRow);
    rows.push({ ...row(`${b!.iso3}:flag:flagToCountry`, b!.iso3, -1), skill: "flag" } as ConceptProgressRow);
    const store = createSessionStore({
      mode: "flag",
      skill: "flag",
      dataset: [a!, b!],
      mixedSubModes: ["flagToCountry", "flagToType"],
      mixedPick: () => null,
    });
    await store.getState().start({ subMode: "mixed" });
    expect([...store.getState().typedRecognition]).toEqual([`${a!.iso3}:flag:flagToCountry`]);
  });

  it("every entity seen, none due: empty with reason 'seenAll'", async () => {
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

  it("startPractice() returns only seen concepts, lowest retrievability first", async () => {
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

    it("a miss in the last two questions is appended and shown again (Task 21)", async () => {
      for (const p of SPAIN_PROVINCES.slice(0, 10)) rows.push(row(findId(p.id), p.id, -1));
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      for (let i = 0; i < 8; i++) {
        store.getState().submit(true);
        store.getState().next();
      }
      const missed8 = store.getState().queue[8]!.id;
      store.getState().submit(false);
      expect(store.getState().queue.map((e) => e.id).at(-1)).toBe(missed8);
      store.getState().next();
      const missed9 = store.getState().queue[9]!.id;
      store.getState().submit(false);
      const ids = store.getState().queue.map((e) => e.id);
      expect(ids).toHaveLength(12);
      expect(ids.at(-1)).toBe(missed9);
      store.getState().next();
      const s = store.getState();
      expect(s.queue[s.index]!.id).toBe(missed8);
      expect(entityIds(store.getState().conceptQueue)).toEqual(ids);
    });

    it("submit keeps what the learner chose until next()", async () => {
      const store = provinceStore();
      await store.getState().start({ subMode: "find" });
      store.getState().submit(false, { chosen: "Cádiz" });
      expect(store.getState().chosen).toBe("Cádiz");
      store.getState().next();
      expect(store.getState().chosen).toBeNull();
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

describe("honest learning load and progress (Task 22)", () => {
  const ccaaStore = () =>
    createSessionStore<SpainEntity>({
      mode: "find",
      skill: "location",
      domain: "spain",
      dataset: SPAIN_CCAA,
      getId: (e) => e.id,
    });

  beforeEach(() => {
    rows.length = 0;
    recorded.length = 0;
    gates.length = 0;
    meta.clear();
  });

  it("new seeds come easy before hard, entities without difficulty last, stable", async () => {
    type E = { id: string; name: string; difficulty?: "easy" | "medium" | "hard" };
    const data: E[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B", difficulty: "hard" },
      { id: "c", name: "C", difficulty: "easy" },
      { id: "d", name: "D", difficulty: "medium" },
      { id: "e", name: "E", difficulty: "easy" },
    ];
    const store = createSessionStore<E>({ mode: "find", skill: "location", dataset: data, getId: (e) => e.id });
    await store.getState().start({ subMode: "find" });
    expect(store.getState().queue.map((e) => e.id)).toEqual(["c", "e", "d", "b", "a"]);

    const flags = createSessionStore({ mode: "flag", skill: "flag" });
    await flags.getState().start({ subMode: "flagToCountry" });
    expect(flags.getState().queue.map((c) => c.iso3)).toEqual(
      COUNTRIES.filter((c) => c.difficulty === "easy").slice(0, 10).map((c) => c.iso3),
    );
  });

  it("summary counts first-try correct over distinct cards, not retry slots", async () => {
    const store = provinceStore();
    await store.getState().start({ subMode: "find" });
    expect(store.getState().cardCount).toBe(10);
    store.getState().submit(false);
    store.getState().next();
    while (store.getState().endedAt === null) {
      store.getState().submit(true);
      store.getState().next();
    }
    expect(store.getState().queue.length).toBeGreaterThan(10);
    expect(store.getState().cardCount).toBe(10);
    expect(store.getState().firstTryCorrect).toBe(9);
  });

  it("at the end, cards with 4+ lapses are tricky and mastered cards are counted", async () => {
    const [p1, p2] = SPAIN_PROVINCES;
    const tricky = { ...row(findId(p1!.id), p1!.id, -1), fsrs_stability: 1, fsrs_lapses: 4 } as ConceptProgressRow;
    const solid = { ...row(findId(p2!.id), p2!.id, -1), fsrs_stability: 30 } as ConceptProgressRow;
    const store = provinceStore();
    await store.getState().start({ conceptRows: [tricky, solid] });
    store.getState().submit(true);
    store.getState().next();
    store.getState().submit(true);
    store.getState().next();
    expect(store.getState().trickyItems.map((t) => t.prompt)).toEqual([p1!.name]);
    expect(store.getState().masteredNow).toBe(1);
  });
});
