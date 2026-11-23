import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { COUNTRIES } from "@/lib/countries";
import { spring } from "@/lib/motion";
import type { Mastery } from "./mastery";

const W = 1000;
const H = 470;
const COLOR: Record<Mastery, string> = {
  new: "rgba(255,255,255,0.3)",
  shaky: "#ff6b6b",
  learning: "#00d4ff",
  solid: "#00ffb2",
};
const LABEL: Record<Mastery, string> = { new: "Not yet", shaky: "Shaky", learning: "Learning", solid: "Solid" };
const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania"] as const;

const r2 = (n: number) => Math.round(n * 100) / 100; // same text on server and client

// Static geometry: nodes sized by land area, edges between countries that share a border.
const NODES = COUNTRIES.filter((c) => c.continent !== "Antarctic").map((c) => ({
  iso3: c.iso3,
  name: c.name,
  continent: c.continent,
  x: r2(((c.coordinates[1] + 180) / 360) * W),
  y: r2(((80 - c.coordinates[0]) / 138) * H),
  r: r2(Math.min(11, Math.max(2.6, Math.sqrt(c.area) / 380))),
}));
const BY_ISO = new Map(NODES.map((n) => [n.iso3, n]));
const EDGES = COUNTRIES.flatMap((c) =>
  c.borders
    .filter((b) => c.iso3 < b && BY_ISO.has(b) && BY_ISO.has(c.iso3))
    .map((b) => ({ a: BY_ISO.get(c.iso3)!, b: BY_ISO.get(b)! }))
    .filter((e) => Math.abs(e.a.x - e.b.x) < W * 0.3),
);
const CENTROID = Object.fromEntries(
  CONTINENTS.map((k) => {
    const list = NODES.filter((n) => n.continent === k);
    return [k, { x: r2(list.reduce((s, n) => s + n.x, 0) / list.length), y: r2(Math.min(...list.map((n) => n.y)) - 18) }];
  }),
);

const dot: Variants = {
  hidden: { opacity: 0, scale: 0.2 },
  show: (delay: number) => ({ opacity: 1, scale: 1, transition: { ...spring.soft, delay } }),
};

/** A network of countries. Nodes take color as you learn them; borders draw in as you scroll. */
export function WorldMap({ mastery }: { mastery: ReadonlyMap<string, Mastery> }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "center 55%"] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const state = (iso: string): Mastery => mastery.get(iso) ?? "new";
  const hovered = hover ? BY_ISO.get(hover) : undefined;

  const perContinent = useMemo(
    () =>
      CONTINENTS.map((k) => {
        const list = NODES.filter((n) => n.continent === k);
        const done = list.filter((n) => (mastery.get(n.iso3) ?? "new") !== "new").length;
        return { k, done, total: list.length };
      }),
    [mastery],
  );

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="w-full overflow-visible">
        {[0.3, 0.5, 0.7].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 8" />
        ))}
        {EDGES.map((e) => {
          const lit = state(e.a.iso3) !== "new" && state(e.b.iso3) !== "new";
          const focus = hover === e.a.iso3 || hover === e.b.iso3;
          const common = {
            x1: e.a.x,
            y1: e.a.y,
            x2: e.b.x,
            y2: e.b.y,
            stroke: focus ? "#a5a0ff" : lit ? "#00d4ff" : "#9ea7ff",
            strokeOpacity: focus ? 0.9 : lit ? 0.5 : 0.2,
            strokeWidth: focus ? 1.2 : 0.7,
          };
          return reduced ? (
            <line key={`${e.a.iso3}-${e.b.iso3}`} {...common} />
          ) : (
            <motion.line key={`${e.a.iso3}-${e.b.iso3}`} {...common} style={{ pathLength: draw }} />
          );
        })}
        <motion.g
          initial={reduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        >
          {NODES.map((n) => {
            const s = state(n.iso3);
            return (
              <motion.circle
                key={n.iso3}
                custom={(n.x / W) * 0.9}
                variants={dot}
                cx={n.x}
                cy={n.y}
                r={hover === n.iso3 ? n.r + 2 : n.r}
                fill={COLOR[s]}
                style={{
                  transformOrigin: `${n.x}px ${n.y}px`,
                  transition: "r 180ms ease-out, fill 300ms ease-out, filter 300ms ease-out",
                  filter: s === "new" ? undefined : `drop-shadow(0 0 5px ${COLOR[s]})`,
                }}
                onPointerEnter={() => setHover(n.iso3)}
                onPointerLeave={() => setHover(null)}
              />
            );
          })}
        </motion.g>
        {CONTINENTS.map((k) => (
          <text key={k} x={CENTROID[k].x} y={CENTROID[k].y} textAnchor="middle" fontSize="13" fill="#f4f5fb" fillOpacity="0.5">
            {k}
          </text>
        ))}
      </svg>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-white/60">
        <p className="min-h-5" aria-live="polite">
          {hovered ? `${hovered.name}: ${LABEL[state(hovered.iso3)]}` : "Hover a country to see it and its neighbors."}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(LABEL) as Mastery[]).map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: COLOR[k] }} />
              {LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-3 lg:grid-cols-5">
        {perContinent.map(({ k, done, total }) => (
          <li key={k}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white/80">{k}</span>
              <span className="font-mono text-white/60 tabular-nums">
                {done}/{total}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full origin-left rounded-full bg-violet"
                style={{ width: `${(done / total) * 100}%`, scaleX: reduced ? 1 : draw }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
