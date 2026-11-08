import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";
import { normalizeState } from "./adapter";

/** Recognition subMode (choose among options) -> its recall subMode (type it). */
export const RECALL_OF: Readonly<Record<string, string>> = {
  flagToCountry: "flagToType",
  name: "nameType",
};

/**
 * Recognition cards whose typed sibling the learner has already answered.
 * Once an entity has been typed, asking it again with options is a step back:
 * these cards are asked typed too. A right typed answer proves recognition, so
 * the grade stays honest.
 */
export function learnedRecallSiblings(rows: readonly ConceptProgressRow[]): Set<string> {
  const answeredRecall = new Set(
    rows.filter((r) => normalizeState(r.fsrs_state) !== State.New).map((r) => r.conceptId),
  );
  const out = new Set<string>();
  for (const r of rows) {
    const parts = r.conceptId.split(":");
    const recall = RECALL_OF[parts[parts.length - 1]!];
    if (!recall) continue;
    if (answeredRecall.has([...parts.slice(0, -1), recall].join(":"))) out.add(r.conceptId);
  }
  return out;
}
