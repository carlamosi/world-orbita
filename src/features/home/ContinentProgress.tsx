import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COUNTRIES } from "@/lib/countries";
import { spring } from "@/lib/motion";
import type { Mastery } from "./mastery";

const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania"] as const;

/** Learned countries per continent. Empty for a new visitor, live for a returning one. */
export function ContinentProgress({ mastery }: { mastery: ReadonlyMap<string, Mastery> }) {
  const reduced = useReducedMotion();
  const rows = useMemo(
    () =>
      CONTINENTS.map((k) => {
        const list = COUNTRIES.filter((c) => c.continent === k);
        const done = list.filter((c) => (mastery.get(c.iso3) ?? "new") !== "new").length;
        return { k, done, total: list.length };
      }),
    [mastery],
  );
  return (
    <ul className="grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map(({ k, done, total }, i) => (
        <li key={k}>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-lg font-medium text-white">{k}</span>
            <span className="font-mono text-sm text-white/65 tabular-nums">
              {done}/{total}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full origin-left rounded-full bg-violet"
              style={{ width: `${Math.max((done / total) * 100, done ? 4 : 0)}%` }}
              initial={reduced ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ ...spring.soft, delay: 0.1 + i * 0.08 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
