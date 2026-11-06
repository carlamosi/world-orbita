// FSRS-1 (moved from src/__audit__/FSRS-1.test.ts): ts-fsrs short-term
// learning_steps must survive row <-> Card persistence, otherwise a Learning
// card restarts at step 0 after every reload and never graduates.
import { describe, it, expect } from "vitest";
import { State, type Card } from "ts-fsrs";
import { createNewCard, processReview, cardToRowUpdates, rowToCard } from "./adapter";
import type { ConceptProgressRow } from "../db/orbita-db";

const MIN = 60_000;

function persist(card: Card): ConceptProgressRow {
  return {
    ...(cardToRowUpdates(card) as ConceptProgressRow),
    conceptId: "FRA:capital:countryToCap",
    iso3: "FRA",
    skill: "capital",
  };
}

describe("FSRS-1: learning_steps survives persistence round trip", () => {
  it("Learning card at step 1 + Good graduates to Review after a round trip", () => {
    const t0 = Date.UTC(2026, 10, 5, 10, 0, 0);
    const r1 = processReview(createNewCard(t0), "good", t0);
    expect(r1.card.state).toBe(State.Learning);
    expect(r1.card.learning_steps).toBe(1);
    const row = persist(r1.card);
    expect(row.fsrs_learning_steps).toBe(1);
    const t1 = r1.card.due.getTime() + 1000;
    // control: in-memory card graduates
    expect(processReview(r1.card, "good", t1).card.state).toBe(State.Review);
    // persisted round trip
    const restored = rowToCard(row);
    expect(restored.learning_steps).toBe(1);
    expect(processReview(restored, "good", t1).card.state).toBe(State.Review);
  });

  it("repeated Good after round trips eventually leaves Learning", () => {
    let t = Date.UTC(2026, 10, 5, 10, 0, 0);
    let card = processReview(createNewCard(t), "good", t).card;
    const states: number[] = [];
    for (let i = 0; i < 5; i++) {
      t = card.due.getTime() + 1000;
      card = processReview(rowToCard(persist(card)), "good", t).card;
      states.push(card.state);
    }
    expect(states).toContain(State.Review);
  });

  it("elapsed_days and scheduled_days round trip too", () => {
    const t0 = Date.UTC(2026, 10, 5, 10, 0, 0);
    let card = processReview(createNewCard(t0), "easy", t0).card;
    card = processReview(card, "good", card.due.getTime() + 1000).card;
    const back = rowToCard(persist(card));
    expect(back.scheduled_days).toBe(card.scheduled_days);
    expect(back.elapsed_days).toBe(card.elapsed_days);
  });
});

describe("elapsed_days is never negative", () => {
  it("is 0 when stored and when read back, whatever the card or row carried", () => {
    const card = { ...createNewCard(Date.UTC(2026, 10, 5)), elapsed_days: -3 };
    const row = persist(card);
    expect(row.fsrs_elapsed_days).toBe(0);
    expect(rowToCard({ ...row, fsrs_elapsed_days: -3 }).elapsed_days).toBe(0);
  });
});

describe("review before last_review (future-dated row)", () => {
  it("grades a Review card whose last_review is 1h ahead without throwing", () => {
    const t0 = Date.UTC(2026, 10, 5, 10, 0, 0);
    let card = processReview(createNewCard(t0), "easy", t0).card;
    card = { ...card, last_review: new Date(t0 + 60 * MIN) };
    const out = processReview(card, "good", t0).card;
    expect(out.last_review!.getTime()).toBeGreaterThan(t0 + 60 * MIN); // strictly, or the server's `>` calls it stale
    expect(persist(out).fsrs_elapsed_days).toBeGreaterThanOrEqual(0);
  });
});

describe("legacy rows without fsrs_learning_steps", () => {
  const base = (state: State, gapMs: number): ConceptProgressRow => {
    const last = Date.UTC(2026, 10, 5, 10, 0, 0);
    return {
      conceptId: "FRA:capital:countryToCap",
      iso3: "FRA",
      skill: "capital",
      fsrs_state: state,
      fsrs_stability: 2,
      fsrs_difficulty: 5,
      fsrs_due: last + gapMs,
      fsrs_reps: 1,
      fsrs_lapses: 0,
      fsrs_last_review: last,
      updated_at: last,
      version: 1,
      dirty: 0,
    };
  };

  it("Learning with a 10 min gap is derived as step 1", () => {
    expect(rowToCard(base(State.Learning, 10 * MIN)).learning_steps).toBe(1);
  });
  it("Learning with a 1 min gap is derived as step 0", () => {
    expect(rowToCard(base(State.Learning, 1 * MIN)).learning_steps).toBe(0);
  });
  it("Relearning always derives step 0 (default relearning_steps has one step)", () => {
    expect(rowToCard(base(State.Relearning, 10 * MIN)).learning_steps).toBe(0);
    expect(rowToCard(base(State.Relearning, 1 * MIN)).learning_steps).toBe(0);
  });
  it("a legacy Relearning card answered Again stays in Relearning", () => {
    const row = { ...base(State.Relearning, 10 * MIN), fsrs_reps: 5, fsrs_lapses: 1 };
    const at = row.fsrs_due + 1000;
    expect(processReview(rowToCard(row), "again", at).card.state).toBe(State.Relearning);
  });
  it("Review rows default to 0", () => {
    expect(rowToCard(base(State.Review, 3 * 86_400_000)).learning_steps).toBe(0);
  });
  it("an explicit stored value wins over the derivation", () => {
    const r = { ...base(State.Learning, 1 * MIN), fsrs_learning_steps: 1 };
    expect(rowToCard(r).learning_steps).toBe(1);
  });
});
