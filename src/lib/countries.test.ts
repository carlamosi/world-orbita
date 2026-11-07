import { describe, it, expect } from "vitest";
import { COUNTRY_BY_ISO3, pickDistractors } from "./countries";

const get = (iso3: string) => COUNTRY_BY_ISO3.get(iso3)!;

describe("pickDistractors (Task 22)", () => {
  it("prefers land neighbours", () => {
    const deu = get("DEU");
    for (let i = 0; i < 20; i++) {
      const out = pickDistractors(deu, 3);
      expect(out).toHaveLength(3);
      for (const c of out) expect(deu.borders).toContain(c.iso3);
    }
  });

  it("then the same subregion", () => {
    const prt = get("PRT");
    for (let i = 0; i < 20; i++) {
      const out = pickDistractors(prt, 3);
      expect(out[0]!.iso3).toBe("ESP");
      for (const c of out.slice(1)) expect(c.subregion).toBe(prt.subregion);
      expect(out.map((c) => c.iso3)).not.toContain("PRT");
    }
  });

  it("keeps the continent filter", () => {
    const isl = get("ISL");
    for (const c of pickDistractors(isl, 3, "Europe")) expect(c.continent).toBe("Europe");
  });
});
