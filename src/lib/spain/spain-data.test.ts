/**
 * Spain dataset validation tests.
 *
 * These tests run against the static data module — no network, no browser.
 * They act as a regression guard so any data edit that breaks invariants
 * is caught immediately in CI.
 */

import { describe, it, expect } from "vitest";
import {
  SPAIN_CCAA,
  SPAIN_PROVINCES,
  SPAIN_CAPITALS,
  SPAIN_ALL,
  validateSpainDataset,
  CCAA_INE_TO_ISO,
  PROVINCE_INE_TO_ISO,
} from "@/lib/spain";

// ---------------------------------------------------------------------------
// Cardinality
// ---------------------------------------------------------------------------

describe("Spain dataset – cardinality", () => {
  it("has exactly 19 autonomous communities/cities", () => {
    const ccaa = SPAIN_CCAA.filter((e) => e.category === "autonomous_community");
    expect(ccaa).toHaveLength(19);
  });

  it("has exactly 50 provinces", () => {
    const provinces = SPAIN_PROVINCES.filter((e) => e.category === "province");
    expect(provinces).toHaveLength(50);
  });

  it("has exactly 19 CCAA-level capitals", () => {
    const caps = SPAIN_CAPITALS.filter(
      (e) => e.category === "capital_autonomous_community",
    );
    expect(caps).toHaveLength(19);
  });

  it("all 50 provinces have a capitalId", () => {
    const provinces = SPAIN_PROVINCES.filter((e) => e.category === "province");
    const missing = provinces.filter((p) => !p.capitalId);
    expect(missing).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ID uniqueness & format
// ---------------------------------------------------------------------------

describe("Spain dataset – IDs", () => {
  it("has no duplicate entity IDs across the entire dataset", () => {
    const ids = SPAIN_ALL.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all entity IDs start with 'ES-'", () => {
    const bad = SPAIN_ALL.filter((e) => !e.id.startsWith("ES-"));
    expect(bad).toHaveLength(0);
  });

  it("all CCAA have a flagCode starting with 'es-'", () => {
    const ccaa = SPAIN_CCAA.filter((e) => e.category === "autonomous_community");
    const bad = ccaa.filter((e) => !e.flagCode?.startsWith("es-"));
    expect(bad).toHaveLength(0);
  });

  it("all polygon entities have an ineCode", () => {
    const polygons = SPAIN_ALL.filter((e) => e.geometryKind === "polygon");
    const missing = polygons.filter((e) => !e.ineCode);
    expect(missing).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// INE code maps
// ---------------------------------------------------------------------------

describe("INE to ISO mappings", () => {
  it("CCAA_INE_TO_ISO covers all 19 CCAA entries", () => {
    expect(Object.keys(CCAA_INE_TO_ISO)).toHaveLength(19);
  });

  it("PROVINCE_INE_TO_ISO covers all 52 province entries (50 + Ceuta + Melilla)", () => {
    expect(Object.keys(PROVINCE_INE_TO_ISO)).toHaveLength(52);
  });

  it("all CCAA entities have a matching INE entry", () => {
    const ccaa = SPAIN_CCAA.filter((e) => e.category === "autonomous_community");
    for (const e of ccaa) {
      expect(e.ineCode).toBeDefined();
      expect(CCAA_INE_TO_ISO[e.ineCode!]).toBe(e.id);
    }
  });

  it("all province entities have a matching INE entry", () => {
    const provinces = SPAIN_PROVINCES.filter((e) => e.category === "province");
    for (const e of provinces) {
      expect(e.ineCode).toBeDefined();
      expect(PROVINCE_INE_TO_ISO[e.ineCode!]).toBe(e.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Referential integrity
// ---------------------------------------------------------------------------

describe("Spain dataset – referential integrity", () => {
  const entityById = new Map(SPAIN_ALL.map((e) => [e.id, e]));

  it("every CCAA capitalId resolves to a capital_autonomous_community", () => {
    const ccaa = SPAIN_CCAA.filter((e) => e.category === "autonomous_community");
    for (const e of ccaa) {
      const cap = entityById.get(e.capitalId!);
      expect(cap, `CCAA ${e.id} capitalId '${e.capitalId}' not found`).toBeDefined();
      expect(cap!.category).toBe("capital_autonomous_community");
    }
  });

  it("every province capitalId resolves to a capital entity", () => {
    const provinces = SPAIN_PROVINCES.filter((e) => e.category === "province");
    for (const p of provinces) {
      const cap = entityById.get(p.capitalId!);
      expect(cap, `Province ${p.id} capitalId '${p.capitalId}' not found`).toBeDefined();
      expect(["capital_province", "capital_autonomous_community"]).toContain(
        cap!.category,
      );
    }
  });

  it("every province parentId resolves to an autonomous_community", () => {
    const provinces = SPAIN_PROVINCES.filter((e) => e.category === "province");
    for (const p of provinces) {
      const parent = entityById.get(p.parentId!);
      expect(parent, `Province ${p.id} parentId '${p.parentId}' not found`).toBeDefined();
      expect(parent!.category).toBe("autonomous_community");
    }
  });

  it("every capital parentId resolves to an existing entity", () => {
    for (const c of SPAIN_CAPITALS) {
      const parent = entityById.get(c.parentId!);
      expect(parent, `Capital ${c.id} parentId '${c.parentId}' not found`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Required CCAA IDs present
// ---------------------------------------------------------------------------

describe("Spain dataset – required CCAA IDs", () => {
  const entityById = new Map(SPAIN_ALL.map((e) => [e.id, e]));
  const requiredCCAAIds = [
    "ES-AN","ES-AR","ES-AS","ES-IB","ES-CN","ES-CB","ES-CL","ES-CM",
    "ES-CT","ES-VC","ES-EX","ES-GA","ES-MD","ES-MC","ES-NC","ES-PV",
    "ES-RI","ES-CE","ES-ML",
  ];

  for (const id of requiredCCAAIds) {
    it(`has ${id}`, () => {
      expect(entityById.has(id)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// validateSpainDataset() integration
// ---------------------------------------------------------------------------

describe("validateSpainDataset()", () => {
  it("returns valid=true with no errors on the real dataset", () => {
    const result = validateSpainDataset();
    if (!result.valid) {
      console.error("Validation errors:", result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports correct stats", () => {
    const { stats } = validateSpainDataset();
    expect(stats.ccaaCount).toBe(19);
    expect(stats.provinceCount).toBe(50);
    expect(stats.capitalCCAACount).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// Concept ID collision guard (domain isolation)
// ---------------------------------------------------------------------------

describe("Spain concept IDs – no collision with world domain", () => {
  it("Spain entity IDs are prefixed differently from world ISO-2 codes", () => {
    // World entities use 2-letter ISO-2 (e.g. 'ES', 'FR'); Spain entities use 'ES-XX'
    const spainIds = SPAIN_ALL.map((e) => e.id);
    for (const id of spainIds) {
      expect(id.length).toBeGreaterThan(2);
      expect(id).toMatch(/^ES-/);
    }
  });
});
