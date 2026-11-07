import { describe, it, expect } from "vitest";
import { fuzzyMatch, isPrefixOfOther } from "@/lib/fuzzy";

const others = ["Iran", "Iraq", "Zambia", "Gambia", "Niger", "Nigeria"];

describe("fuzzyMatch with other entity names", () => {
  it("rejects another real entity as a typo", () => {
    expect(fuzzyMatch("Iraq", "Iran", [], others)).toBe(false);
    expect(fuzzyMatch("Gambia", "Zambia", [], others)).toBe(false);
  });
  it("still accepts real typos and exact answers", () => {
    expect(fuzzyMatch("Irann", "Iran", [], others)).toBe(true);
    expect(fuzzyMatch("Zambai", "Zambia", [], others)).toBe(true);
    expect(fuzzyMatch("iran", "Iran", [], others)).toBe(true);
  });
  it("accepts an alternative name exactly", () => {
    expect(fuzzyMatch("Ivory Coast", "Cote d'Ivoire", ["Ivory Coast"], others)).toBe(true);
  });
});

describe("isPrefixOfOther", () => {
  it("is true for a strict prefix of another name", () => {
    expect(isPrefixOfOther("Niger", others)).toBe(true);
    expect(isPrefixOfOther("Nige", others)).toBe(true);
  });
  it("is false for a full name that prefixes nothing", () => {
    expect(isPrefixOfOther("Nigeria", others)).toBe(false);
    expect(isPrefixOfOther("Iran", others)).toBe(false);
  });
});
