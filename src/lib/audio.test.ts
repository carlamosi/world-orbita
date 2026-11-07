import { describe, it, expect } from "vitest";
import { streakRatio } from "./audio";

describe("streakRatio", () => {
  it("rises one pentatonic step per hit in a row, then starts over", () => {
    const r = [0, 1, 2, 3, 4, 5].map(streakRatio);
    expect(r[0]).toBe(1);
    for (let i = 1; i < 5; i++) expect(r[i]!).toBeGreaterThan(r[i - 1]!);
    expect(r[5]).toBe(1);
    expect(r[3]).toBeCloseTo(2 ** (7 / 12));
  });
});
