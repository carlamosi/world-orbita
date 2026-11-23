import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useReducedMotion, useScroll, useMotionValueEvent, useSpring } from "framer-motion";
import { COUNTRIES, COUNTRY_BY_ISO3 } from "@/lib/countries";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Fixed teasers so server and client render the same first frame.
const QUESTIONS = [
  { answer: "KEN", options: ["UGA", "KEN", "TZA", "ETH"] },
  { answer: "BRA", options: ["ARG", "COL", "BRA", "PER"] },
  { answer: "JPN", options: ["KOR", "JPN", "PHL", "CHN"] },
  { answer: "NOR", options: ["NOR", "SWE", "FIN", "DNK"] },
] as const;

const R = 170;
const rad = (d: number) => (d * Math.PI) / 180;

/** Orthographic projection of a country dot; null when it is on the far side. */
function project(lat: number, lng: number, lat0: number, lng0: number) {
  const dl = rad(lng - lng0);
  const z = Math.sin(rad(lat0)) * Math.sin(rad(lat)) + Math.cos(rad(lat0)) * Math.cos(rad(lat)) * Math.cos(dl);
  if (z <= 0) return null;
  const x = Math.cos(rad(lat)) * Math.sin(dl);
  const y = Math.cos(rad(lat0)) * Math.sin(rad(lat)) - Math.sin(rad(lat0)) * Math.cos(rad(lat)) * Math.cos(dl);
  const r2 = (n: number) => Math.round(n * 100) / 100; // equal text on server and client
  return { x: r2(200 + x * R), y: r2(200 - y * R), z: r2(z) };
}

/** Parallels every 30 degrees and meridians every 30, as path text (strings keep server and client identical). */
function graticulePath(lat0: number, lng0: number) {
  let d = "";
  const add = (pts: [number, number][]) => {
    let pen = false;
    for (const [la, lo] of pts) {
      const p = project(la, lo, lat0, lng0);
      if (!p) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true;
    }
  };
  for (let la = -60; la <= 60; la += 30) add(Array.from({ length: 73 }, (_, i) => [la, -180 + i * 5] as [number, number]));
  for (let lo = -180; lo < 180; lo += 30) add(Array.from({ length: 37 }, (_, i) => [-90 + i * 5, lo] as [number, number]));
  return d;
}

export function LiveQuestion() {
  const reduced = useReducedMotion();
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const question = QUESTIONS[q];
  const target = COUNTRY_BY_ISO3.get(question.answer)!;

  // The globe turns to the new country; the page scroll adds a slow drift.
  const [lng0, setLng0] = useState(target.coordinates[1]);
  const lngRef = useRef(lng0);
  const [drift, setDrift] = useState(0);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    if (!reduced) setDrift(Math.min(y, 600) * 0.04);
  });
  useEffect(() => {
    const to = target.coordinates[1];
    if (reduced) {
      lngRef.current = to;
      setLng0(to);
      return;
    }
    const c = animate(lngRef.current, to, {
      ...spring.heavy,
      onUpdate: (v) => {
        lngRef.current = v;
        setLng0(v);
      },
    });
    return () => c.stop();
  }, [target, reduced]);

  // Pointer over the globe tilts it toward the cursor and names the nearest country.
  const tx = useSpring(0, spring.soft);
  const ty = useSpring(0, spring.soft);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [near, setNear] = useState<{ iso3: string; x: number; y: number } | null>(null);
  useMotionValueEvent(tx, "change", (v) => setTilt((t) => ({ ...t, x: v })));
  useMotionValueEvent(ty, "change", (v) => setTilt((t) => ({ ...t, y: v })));
  const lat0 = target.coordinates[0] * 0.6 + tilt.y;
  const viewLng = lng0 + drift + tilt.x;
  const dots = useMemo(
    () =>
      COUNTRIES.map((c) => {
        const p = project(c.coordinates[0], c.coordinates[1], lat0, viewLng);
        return p ? { iso3: c.iso3, a: c.area, ...p } : null;
      }).filter((d): d is NonNullable<typeof d> => d !== null),
    [lat0, viewLng],
  );
  const graticule = useMemo(() => graticulePath(lat0, viewLng), [lat0, viewLng]);
  const hit = dots.find((d) => d.iso3 === question.answer);
  const drag = useRef<{ x: number; y: number; bx: number; by: number } | null>(null);
  const backTimer = useRef<number | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const toSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
  };
  const nearest = (px: number, py: number) => {
    const sx = -20 + px * 440;
    const sy = -20 + py * 440;
    let best: { iso3: string; x: number; y: number } | null = null;
    let bd = 14 * 14;
    for (const d of dots) {
      const dd = (d.x - sx) ** 2 + (d.y - sy) ** 2;
      if (dd < bd) {
        bd = dd;
        best = { iso3: d.iso3, x: d.x, y: d.y };
      }
    }
    return best;
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    window.clearTimeout(backTimer.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, bx: tx.get(), by: ty.get() };
    setDragging(true);
    setNear(null);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { px, py } = toSvg(e);
    if (drag.current) {
      const d = drag.current;
      tx.set(d.bx - (e.clientX - d.x) * 0.35);
      ty.set(Math.max(-45, Math.min(45, d.by + (e.clientY - d.y) * 0.25)));
      return;
    }
    if (reduced) {
      setNear(nearest(px, py));
      return;
    }
    tx.set((px - 0.5) * 30);
    ty.set((0.5 - py) * 16);
    setNear(nearest(px, py));
  };
  // Letting go sends the globe back to the question after a calm pause.
  const release = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    backTimer.current = window.setTimeout(() => {
      tx.set(0);
      ty.set(0);
    }, 2200);
  };
  const onLeave = () => {
    if (drag.current) return;
    tx.set(0);
    ty.set(0);
    setNear(null);
  };
  const answered = picked !== null;
  const correct = picked === question.answer;

  const next = () => {
    setPicked(null);
    setQ((i) => (i + 1) % QUESTIONS.length);
  };

  return (
    <div className="flex flex-col gap-5">
      <svg
        viewBox="-20 -20 440 440"
        role="img"
        aria-label="A globe with one country highlighted in violet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={onLeave}
        style={{ touchAction: "pan-y" }}
        className={cn("w-full max-w-[560px] mx-auto select-none", dragging ? "cursor-grabbing" : "cursor-grab")}
      >
        <defs>
          <radialGradient id="home-sphere" cx="34%" cy="30%" r="85%">
            <stop offset="0%" stopColor="#222862" />
            <stop offset="55%" stopColor="#0b0d1f" />
            <stop offset="100%" stopColor="#050508" />
          </radialGradient>
          <radialGradient id="home-atmo" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#00d4ff" stopOpacity="0" />
            <stop offset="92%" stopColor="#6c63ff" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="home-shade" x1="0" x2="1" y1="0.1" y2="0.9">
            <stop offset="35%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r={R + 24} fill="url(#home-atmo)" />
        <g transform="rotate(-18 200 200)" aria-hidden="true">
          <ellipse cx="200" cy="200" rx={R + 34} ry="52" fill="none" stroke="#9ea7ff" strokeOpacity="0.16" strokeWidth="0.8" />
          {!reduced && (
            <circle r="2.6" fill="#a5a0ff">
              <animateMotion dur="36s" repeatCount="indefinite" path={`M ${200 - (R + 34)} 200 a ${R + 34} 52 0 1 0 ${(R + 34) * 2} 0 a ${R + 34} 52 0 1 0 ${-(R + 34) * 2} 0`} />
            </circle>
          )}
        </g>
        <circle cx="200" cy="200" r={R + 6} fill="url(#home-sphere)" />
        <path d={graticule} fill="none" stroke="#9ea7ff" strokeOpacity="0.16" strokeWidth="0.6" />
        {dots.map((d) =>
          d.iso3 === question.answer ? null : (
            <circle key={d.iso3} cx={d.x} cy={d.y} r={((0.9 + Math.min(2.2, Math.sqrt(d.a) / 1100)) * (0.6 + d.z * 0.7)).toFixed(2)} fill="#f4f5fb" opacity={(0.1 + d.z * 0.45).toFixed(2)} />
          ),
        )}
        <circle cx="200" cy="200" r={R + 6} fill="url(#home-shade)" />
        <ellipse cx="150" cy="120" rx="95" ry="70" fill="#fff" fillOpacity="0.035" />
        <circle cx="200" cy="200" r={R + 6} fill="none" stroke="#00d4ff" strokeOpacity="0.28" strokeWidth="1" />
        {near && near.iso3 !== question.answer && (
          <g aria-hidden="true">
            <circle cx={near.x} cy={near.y} r="9" fill="none" stroke="#00d4ff" strokeOpacity="0.6" />
            <circle cx={near.x} cy={near.y} r="3.2" fill="#00d4ff" />
          </g>
        )}
        {hit && (
          <g>
            {!reduced && (
              <motion.circle
                cx={hit.x}
                cy={hit.y}
                r={7}
                fill="none"
                stroke="var(--violet)"
                strokeWidth={1.5}
                animate={{ scale: [1, 2.8], opacity: [0.8, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                style={{ transformOrigin: `${hit.x}px ${hit.y}px` }}
              />
            )}
            <circle cx={hit.x} cy={hit.y} r={11} fill={answered ? (correct ? "#00ffb2" : "#ff6b6b") : "#6c63ff"} fillOpacity="0.25" />
            <circle cx={hit.x} cy={hit.y} r={6} fill={answered ? (correct ? "#00ffb2" : "#ff6b6b") : "#a5a0ff"} />
            {answered && (
              <text x={hit.x} y={hit.y - 16} textAnchor="middle" fontSize="13" fontWeight="500" fill="#f4f5fb" stroke="#050508" strokeWidth="3" paintOrder="stroke">
                {target.name}
              </text>
            )}
          </g>
        )}
        {near && near.iso3 !== question.answer && (
          <text x={near.x} y={near.y - 15} textAnchor="middle" fontSize="12" fill="#f4f5fb" stroke="#050508" strokeWidth="3" paintOrder="stroke">
            {COUNTRY_BY_ISO3.get(near.iso3)?.name}
          </text>
        )}
      </svg>
      <p className="-mt-2 text-center text-sm text-white/60">Drag to turn the globe. Hover a marker for its name.</p>

      <div className="glass rounded-2xl p-5 md:p-6">
        <h2 className="font-display text-xl font-medium tracking-tight text-white">Which country is highlighted?</h2>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {question.options.map((iso) => {
            const name = COUNTRY_BY_ISO3.get(iso)?.name ?? iso;
            const isAnswer = iso === question.answer;
            return (
              <motion.button
                key={`${q}-${iso}`}
                type="button"
                disabled={answered}
                onClick={() => setPicked(iso)}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                transition={spring.micro}
                className={cn(
                  "h-12 rounded-xl border px-4 text-left text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan/60",
                  !answered && "border-white/15 text-white hover:border-white/30 hover:bg-white/5",
                  answered && isAnswer && "border-neon/60 bg-neon/10 text-neon",
                  answered && !isAnswer && iso === picked && "border-coral/60 bg-coral/10 text-coral",
                  answered && !isAnswer && iso !== picked && "border-white/10 text-white/50",
                )}
              >
                {name}
              </motion.button>
            );
          })}
        </div>
        <div className="mt-4 flex min-h-9 items-center justify-between gap-3" aria-live="polite">
          {answered ? (
            <>
              <p className="text-sm text-white/70">
                {correct ? `Correct, it is ${target.name}.` : `It was ${target.name}.`}
              </p>
              <button
                type="button"
                onClick={next}
                className="rounded-full px-3 py-1.5 text-sm text-white/80 outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan/60"
              >
                Next question
              </button>
            </>
          ) : (
            <p className="text-sm text-white/60">A sample question. Start playing to practice for real.</p>
          )}
        </div>
      </div>
    </div>
  );
}
