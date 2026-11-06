import { describe, it, expect } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow, UnlockRow } from "@/lib/db/orbita-db";
import { COUNTRIES } from "@/lib/countries";
import { evaluateUnlocks } from "./unlocks";

const now = Date.now();
const oceania = COUNTRIES.filter((c) => c.continent === "Oceania");

// Reviewed just now, so retrievability is ~1 whatever the stability.
function rowFor(iso3: string, stability: number): ConceptProgressRow {
  return {
    conceptId: `world:${iso3}:flag:flagToCountry`,
    iso3,
    skill: "flag",
    fsrs_state: State.Review,
    fsrs_stability: stability,
    fsrs_difficulty: 5,
    fsrs_due: now + stability * 86_400_000,
    fsrs_reps: 3,
    fsrs_lapses: 0,
    fsrs_last_review: now,
    updated_at: now,
    version: 1,
    dirty: 0,
  } as unknown as ConceptProgressRow;
}

const run = (progress: ConceptProgressRow[], existing = new Map<string, UnlockRow>()) =>
  evaluateUnlocks({ progress, sessions: [], now, existing }).find((d) => d.key === "oceania_mastered");

describe("region unlocks use the mastered-card rule (Task 22)", () => {
  it("high retrievability alone does not unlock a region", () => {
    const d = run(oceania.map((c) => rowFor(c.iso3, 5)));
    expect(d?.unlockedAt ?? null).toBeNull();
  });

  it("every country with a mastered card unlocks the region", () => {
    const d = run(oceania.map((c) => rowFor(c.iso3, 30)));
    expect(d?.unlockedAt).toBe(now);
  });

  it("an unlock already earned is never revoked", () => {
    const earned = new Map<string, UnlockRow>([
      ["oceania_mastered", { key: "oceania_mastered", progress: 0.5, unlockedAt: 123, updatedAt: 123 }],
    ]);
    const d = run(oceania.map((c) => rowFor(c.iso3, 5)), earned);
    expect(d?.unlockedAt).toBe(123);
  });
});
