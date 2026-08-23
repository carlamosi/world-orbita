/**
 * Spain dataset validation.
 *
 * Pure validation logic with no side effects — can be imported by tests,
 * CI scripts, or runtime debug pages.  All checks are deterministic and
 * require no network access.
 */

import {
  SPAIN_CCAA,
  SPAIN_PROVINCES,
  SPAIN_CAPITALS,
  SPAIN_ALL,
} from "./data";
import type { SpainEntity } from "./types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  stats: {
    totalEntities: number;
    ccaaCount: number;
    provinceCount: number;
    capitalCCAACount: number;
    capitalProvinceCount: number;
  };
}

export function validateSpainDataset(): ValidationResult {
  const errors: string[] = [];

  // ── 1. Cardinality ────────────────────────────────────────────────────────

  const ccaa = SPAIN_CCAA.filter((e) => e.category === "autonomous_community");
  const provinces = SPAIN_PROVINCES.filter((e) => e.category === "province");
  const capsCC = SPAIN_CAPITALS.filter(
    (e) => e.category === "capital_autonomous_community",
  );
  const capsProv = SPAIN_CAPITALS.filter(
    (e) => e.category === "capital_province",
  );

  // Spain has 17 CCAA + 2 autonomous cities = 19 top-level entities
  if (ccaa.length !== 19) {
    errors.push(
      `Expected 19 autonomous communities/cities, got ${ccaa.length}`,
    );
  }

  if (provinces.length !== 50) {
    errors.push(`Expected 50 provinces, got ${provinces.length}`);
  }

  if (capsCC.length !== 19) {
    errors.push(
      `Expected 19 CCAA capital entities, got ${capsCC.length}`,
    );
  }

  // 50 provinces → 50 province capitals
  // BUT: some province capitals share an ID with a CCAA capital (e.g. ES-MAD)
  // so the unique count may be less; check parentId coverage instead
  const provincesWithCapital = provinces.filter((p) => p.capitalId != null);
  if (provincesWithCapital.length !== 50) {
    errors.push(
      `Expected all 50 provinces to have capitalId, found ${provincesWithCapital.length}`,
    );
  }

  // ── 2. Unique IDs across all entities ──────────────────────────────────

  const allIds = SPAIN_ALL.map((e) => e.id);
  const idSet = new Set(allIds);
  if (idSet.size !== allIds.length) {
    const seen = new Set<string>();
    for (const id of allIds) {
      if (seen.has(id)) errors.push(`Duplicate entity ID: ${id}`);
      seen.add(id);
    }
  }

  // ── 3. Every entity has required fields ──────────────────────────────────

  for (const e of SPAIN_ALL) {
    if (!e.id) errors.push(`Entity missing id: ${JSON.stringify(e.name)}`);
    if (!e.name) errors.push(`Entity ${e.id} missing name`);
    if (!e.domain || e.domain !== "spain")
      errors.push(`Entity ${e.id} has wrong domain: ${e.domain}`);
    if (!e.category)
      errors.push(`Entity ${e.id} missing category`);
    if (!e.coordinates || e.coordinates.length !== 2)
      errors.push(`Entity ${e.id} missing/invalid coordinates`);
    if (!e.geometryKind)
      errors.push(`Entity ${e.id} missing geometryKind`);
  }

  // ── 4. ID format: all must be ES- prefixed ────────────────────────────────

  const badIds = SPAIN_ALL.filter((e) => !e.id.startsWith("ES-"));
  for (const e of badIds) {
    errors.push(`Entity ID does not start with 'ES-': ${e.id}`);
  }

  // ── 5. INE codes on polygon entities ──────────────────────────────────────

  for (const e of [...ccaa, ...provinces]) {
    if (!e.ineCode) errors.push(`Polygon entity ${e.id} missing ineCode`);
  }

  // ── 6. Flag codes on CCAA entities ───────────────────────────────────────

  for (const e of ccaa) {
    if (!e.flagCode)
      errors.push(`CCAA entity ${e.id} missing flagCode`);
    else if (!e.flagCode.startsWith("es-"))
      errors.push(`CCAA entity ${e.id} flagCode bad format: ${e.flagCode}`);
  }

  // ── 7. Capital cross-references ───────────────────────────────────────────

  const entityById = new Map<string, SpainEntity>(
    SPAIN_ALL.map((e) => [e.id, e]),
  );

  // CCAA capitalId must resolve to a capital_autonomous_community entity
  for (const e of ccaa) {
    if (!e.capitalId) {
      errors.push(`CCAA ${e.id} missing capitalId`);
      continue;
    }
    const cap = entityById.get(e.capitalId);
    if (!cap) {
      errors.push(
        `CCAA ${e.id} capitalId '${e.capitalId}' not found in dataset`,
      );
    } else if (cap.category !== "capital_autonomous_community") {
      errors.push(
        `CCAA ${e.id} capitalId '${e.capitalId}' resolves to wrong category: ${cap.category}`,
      );
    }
  }

  // Province capitalId must resolve to a capital entity
  for (const p of provinces) {
    if (!p.capitalId) {
      errors.push(`Province ${p.id} missing capitalId`);
      continue;
    }
    const cap = entityById.get(p.capitalId);
    if (!cap) {
      errors.push(
        `Province ${p.id} capitalId '${p.capitalId}' not found in dataset`,
      );
    } else if (
      cap.category !== "capital_province" &&
      cap.category !== "capital_autonomous_community"
    ) {
      // Some province capitals double as CCAA capitals (e.g. ES-MAD)
      errors.push(
        `Province ${p.id} capitalId '${p.capitalId}' resolves to unexpected category: ${cap.category}`,
      );
    }
  }

  // Capital parentId must resolve to a CCAA or province
  for (const c of SPAIN_CAPITALS) {
    if (!c.parentId) {
      errors.push(`Capital ${c.id} missing parentId`);
      continue;
    }
    const parent = entityById.get(c.parentId);
    if (!parent) {
      errors.push(
        `Capital ${c.id} parentId '${c.parentId}' not found in dataset`,
      );
    } else if (
      parent.category !== "autonomous_community" &&
      parent.category !== "province"
    ) {
      errors.push(
        `Capital ${c.id} parentId '${c.parentId}' resolves to wrong category: ${parent.category}`,
      );
    }
  }

  // ── 8. Province parentId → CCAA ──────────────────────────────────────────

  for (const p of provinces) {
    if (!p.parentId) {
      errors.push(`Province ${p.id} missing parentId`);
      continue;
    }
    const parent = entityById.get(p.parentId);
    if (!parent) {
      errors.push(
        `Province ${p.id} parentId '${p.parentId}' not found in dataset`,
      );
    } else if (parent.category !== "autonomous_community") {
      errors.push(
        `Province ${p.id} parentId '${p.parentId}' resolves to wrong category: ${parent.category}`,
      );
    }
  }

  // ── 9. Coordinate range check ─────────────────────────────────────────────

  for (const e of SPAIN_ALL) {
    const [lat, lng] = e.coordinates;
    // Spain mainland + Canarias + Ceuta/Melilla
    if (lat < 27 || lat > 45 || lng < -19 || lng > 5) {
      errors.push(
        `Entity ${e.id} has suspicious coordinates: [${lat}, ${lng}]`,
      );
    }
  }

  // ── 10. Expected specific CCAA IDs are present ───────────────────────────

  const requiredCCAAIds = [
    "ES-AN","ES-AR","ES-AS","ES-IB","ES-CN","ES-CB","ES-CL","ES-CM",
    "ES-CT","ES-VC","ES-EX","ES-GA","ES-MD","ES-MC","ES-NC","ES-PV",
    "ES-RI","ES-CE","ES-ML",
  ];
  for (const id of requiredCCAAIds) {
    if (!entityById.has(id)) errors.push(`Required CCAA entity missing: ${id}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      totalEntities: SPAIN_ALL.length,
      ccaaCount: ccaa.length,
      provinceCount: provinces.length,
      capitalCCAACount: capsCC.length,
      capitalProvinceCount: capsProv.length,
    },
  };
}
