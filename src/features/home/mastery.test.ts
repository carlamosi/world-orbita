import { describe, it, expect } from "vitest";
import { masteryOf } from "./mastery";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";

const row = (o: Partial<ConceptProgressRow>) =>
  ({ fsrs_state: 2, fsrs_reps: 1, fsrs_stability: 1, ...o }) as ConceptProgressRow;

describe("home map: what color a country gets", () => {
  it("a country with no answered card stays grey, so a new visitor sees an empty map", () => {
    expect(masteryOf([]), "no rows").toBe("new");
    expect(masteryOf([row({ fsrs_reps: 0, fsrs_state: 0 })]), "card created but never answered").toBe("new");
  });

  it("a card that is being relearned makes the country shaky even if another skill is solid", () => {
    const rows = [row({ fsrs_stability: 40 }), row({ fsrs_state: 3 })];
    expect(masteryOf(rows), "a forgotten card must show on the map: hiding it would hide what needs review").toBe("shaky");
  });

  it("a country is solid only when every studied skill is mastered", () => {
    expect(masteryOf([row({ fsrs_stability: 30 }), row({ fsrs_stability: 25 })]), "all mastered").toBe("solid");
    expect(masteryOf([row({ fsrs_stability: 30 }), row({ fsrs_stability: 3 })]), "one skill still young").toBe("learning");
  });
});
