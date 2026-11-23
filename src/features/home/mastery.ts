import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/orbita-db";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";
import { isMastered } from "@/lib/fsrs/adapter";

export type Mastery = "new" | "shaky" | "learning" | "solid";

const RELEARNING = 3; // ts-fsrs State.Relearning

/** One country's state from its FSRS rows across skills (location, name, flag, capital). */
export function masteryOf(rows: readonly ConceptProgressRow[]): Mastery {
  const studied = rows.filter((r) => r.fsrs_reps > 0);
  if (studied.length === 0) return "new";
  if (studied.some((r) => r.fsrs_state === RELEARNING)) return "shaky";
  return studied.every(isMastered) ? "solid" : "learning";
}

/** Live map of iso3 to state; countries never studied are absent. */
export function useCountryMastery(): ReadonlyMap<string, Mastery> {
  const map = useLiveQuery(
    async () => {
      try {
        const rows = await db().concept_progress.toArray();
        const byIso = new Map<string, ConceptProgressRow[]>();
        for (const r of rows) byIso.set(r.iso3, [...(byIso.get(r.iso3) ?? []), r]);
        const out = new Map<string, Mastery>();
        for (const [iso, list] of byIso) out.set(iso, masteryOf(list));
        return out;
      } catch {
        return new Map<string, Mastery>();
      }
    },
    [],
    new Map<string, Mastery>(),
  );
  return map ?? new Map();
}
