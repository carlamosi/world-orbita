import { useEffect, useState } from "react";
import { db, ALL_SKILLS } from "@/lib/db/orbita-db";
import { getDueTodayCount } from "@/lib/fsrs/planner";
import { useLiveQuery } from "dexie-react-hooks";

/**
 * Returns the live count of cards due right now across all FSRS skills.
 * Reacts instantly to Dexie DB changes (via useLiveQuery) and polls every 10s
 * to catch cards whose due timestamp crosses `now` without DB changes.
 */
export function useDueTodayCount(): number {
  const [tick, setTick] = useState(Date.now());

  // Force re-evaluation of time-based "due" status every 10s
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const count = useLiveQuery(
    async () => {
      try {
        const all = [];
        for (const skill of ALL_SKILLS) {
          const rows = await db().concept_progress.where("skill").equals(skill).toArray();
          all.push(...rows);
        }
        return getDueTodayCount(all, Date.now()); // Date.now() used here but the query re-runs because `tick` isn't in deps?
      } catch {
        return 0;
      }
    },
    [tick], // tick dependency forces useLiveQuery to re-execute every 10s
    0
  );

  return count ?? 0;
}
