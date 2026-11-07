// @vitest-environment jsdom
// Speed is a fluency game: it never writes FSRS state, and a miss shows the
// correct option for REVEAL_MS before moving on.
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { swap } from "@/lib/db/dbProvider";
import { db } from "@/lib/db/orbita-db";

vi.mock("@/lib/audio", () => ({ playAnswerSound: vi.fn() }));

import { useSpeedRuntime } from "./speedRuntimeStore";

const DIR: Record<string, string> = {
  name: "name",
  flag: "countryToFlag",
  capital: "countryToCap",
  location: "capToCountry",
};

async function seedConceptFor(i: number) {
  const it = useSpeedRuntime.getState().queue[i]!;
  const skill = it.skill === "location" ? "capital" : it.skill;
  await db().concept_progress.put({
    conceptId: `${it.country.iso3}:${skill}:${DIR[it.skill]}`,
    iso3: it.country.iso3,
    skill,
    fsrs_state: 0,
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_due: 0,
    fsrs_reps: 0,
    fsrs_lapses: 0,
    fsrs_last_review: 0,
    updated_at: 0,
    version: 0,
    dirty: 0,
  });
}

const wrongIso = () => {
  const s = useSpeedRuntime.getState();
  const it = s.queue[s.index]!;
  return it.options.find((o) => o.iso3 !== it.country.iso3)!.iso3;
};

beforeEach(async () => {
  await swap(crypto.randomUUID());
  useSpeedRuntime.getState().reset();
  await useSpeedRuntime.getState().start("sprint60");
});
afterEach(() => {
  useSpeedRuntime.getState().reset();
  vi.useRealTimers();
});

describe("speed runtime", () => {
  it("writes no concept_progress, question_history or outbox", async () => {
    await seedConceptFor(0);
    await seedConceptFor(1);
    const before = await db().concept_progress.toArray();
    const s = useSpeedRuntime.getState();
    s.answer(s.queue[0]!.country.iso3); // right
    await new Promise((r) => setTimeout(r, 50));
    expect(await db().question_history.count()).toBe(0);
    expect(await db().outbox.count()).toBe(0);
    expect(await db().concept_progress.toArray()).toEqual(before);
  });

  it("a miss keeps the question, exposes the answer, ignores input, then advances", async () => {
    vi.useFakeTimers();
    const s = useSpeedRuntime.getState();
    const item = s.queue[0]!;
    s.answer(wrongIso());
    let st = useSpeedRuntime.getState();
    expect(st.index).toBe(0);
    expect(st.reveal?.correctIso3).toBe(item.country.iso3);
    expect(st.wrong).toBe(1);
    st.answer(item.country.iso3); // click during the reveal: ignored
    st.skip();
    st = useSpeedRuntime.getState();
    expect(st.score).toBe(0);
    expect(st.wrong).toBe(1);
    expect(st.index).toBe(0);
    vi.advanceTimersByTime(800);
    st = useSpeedRuntime.getState();
    expect(st.reveal).toBeNull();
    expect(st.index).toBe(1);
  });

  it("score still counts: right answers score, a miss resets combo", async () => {
    vi.useFakeTimers();
    const a = () => {
      const s = useSpeedRuntime.getState();
      s.answer(s.queue[s.index]!.country.iso3);
    };
    a();
    a();
    expect(useSpeedRuntime.getState().score).toBe(20);
    useSpeedRuntime.getState().answer(wrongIso());
    vi.advanceTimersByTime(800);
    a();
    const st = useSpeedRuntime.getState();
    expect(st.score).toBe(30);
    expect(st.correct).toBe(3);
    expect(st.wrong).toBe(1);
    expect(st.combo).toBe(1);
    expect(st.bestCombo).toBe(2);
  });
});
