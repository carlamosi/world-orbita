import { useEffect, useState } from "react";
import { db, ALL_SKILLS } from "@/lib/db/orbita-db";
import { getDueTodayCount } from "@/lib/fsrs/planner";

/**
 * Returns the live count of cards due right now across all FSRS skills.
 * Re-polls every 30 s to catch any cards whose due timestamp crosses `now`.
 */
export function useDueTodayCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const all = [];
        for (const skill of ALL_SKILLS) {
          const rows = await db().concept_progress.where("skill").equals(skill).toArray();
          all.push(...rows);
        }
        if (mounted) setCount(getDueTodayCount(all));
      } catch {
        // DB not ready yet (SSR or first load) — silently ignore
      }
    }

    void refresh();

    const id = window.setInterval(() => void refresh(), 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return count;
}
