import { describe, it, expect } from "vitest";
import { COUNTRY_BY_ISO3, COUNTRIES } from "@/lib/countries";
import { FLAG_LOOKALIKE_GROUPS, flagLookalikesOf, pickLookalikeDistractors } from "./flagLookalikes";

describe("flag look-alikes", () => {
  it("every code in the groups is a country in the game", () => {
    const missing = FLAG_LOOKALIKE_GROUPS.flat().filter((c) => !COUNTRY_BY_ISO3.has(c));
    expect(missing).toEqual([]);
  });

  it("Chad's look-alikes include Romania, and never Chad itself", () => {
    const iso = flagLookalikesOf("TCD").map((c) => c.iso3);
    expect(iso).toContain("ROU");
    expect(iso).not.toContain("TCD");
  });

  it("distractors are look-alikes first, filled from the fallback, unique, never the target", () => {
    const chad = COUNTRY_BY_ISO3.get("TCD")!;
    const d = pickLookalikeDistractors(chad, 3, COUNTRIES.slice(0, 20));
    expect(d).toHaveLength(3);
    expect(new Set(d.map((c) => c.iso3)).size).toBe(3);
    expect(d.every((c) => ["ROU", "AND", "MDA"].includes(c.iso3))).toBe(true);

    const qatar = COUNTRY_BY_ISO3.get("QAT")!;
    const q = pickLookalikeDistractors(qatar, 3, COUNTRIES.slice(0, 20));
    expect(q.map((c) => c.iso3)).toContain("BHR");
    expect(q).toHaveLength(3);
    expect(q.some((c) => c.iso3 === "QAT")).toBe(false);
  });

  it("a flag with no look-alikes falls back entirely", () => {
    const fallback = COUNTRIES.filter((c) => c.iso3 !== "BRA").slice(0, 3);
    const d = pickLookalikeDistractors(COUNTRY_BY_ISO3.get("BRA")!, 3, fallback);
    expect(d).toEqual(fallback);
  });
});
