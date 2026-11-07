import { describe, it, expect } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";
import { cardToRowUpdates, isMastered, processReview, rowToCard } from "./adapter";

const MIN = 60_000;
const DAY = 86_400_000;

function newRow(): ConceptProgressRow {
  return {
    conceptId: "FRA:location:find",
    iso3: "FRA",
    skill: "location",
    fsrs_state: State.New as unknown as ConceptProgressRow["fsrs_state"],
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_due: 0,
    fsrs_reps: 0,
    fsrs_lapses: 0,
    fsrs_last_review: 0,
    updated_at: 0,
    version: 1,
    dirty: 0,
  } as ConceptProgressRow;
}

function review(row: ConceptProgressRow, at: number): ConceptProgressRow {
  const { card } = processReview(rowToCard(row), "good", at);
  return { ...row, ...cardToRowUpdates(card, 1, true, row.version) };
}

describe("mastery needs sleep (consolidation across days)", () => {
  it("right answers all on one day never make a card mastered", () => {
    const start = Date.UTC(2026, 10, 8, 9);
    let row = newRow();
    // Every few minutes for 12 hours: far more same-day practice than any session.
    for (let t = start; t < start + 12 * 60 * MIN; t += 15 * MIN) {
      row = review(row, t);
      expect(isMastered(row)).toBe(false);
    }
  });

  it("right answers spread over weeks do make it mastered", () => {
    let row = newRow();
    let t = Date.UTC(2026, 10, 8, 9);
    for (let i = 0; i < 12 && !isMastered(row); i++) {
      row = review(row, t);
      t = Math.max(t + 10 * MIN, row.fsrs_due);
    }
    expect(isMastered(row)).toBe(true);
    expect(row.fsrs_last_review - Date.UTC(2026, 10, 8, 9)).toBeGreaterThan(DAY);
  });
});
