import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useReducedMotion, useScroll, useMotionValueEvent } from "framer-motion";
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

  const lat0 = target.coordinates[0] * 0.6;
  const dots = useMemo(
    () =>
      COUNTRIES.map((c) => {
        const p = project(c.coordinates[0], c.coordinates[1], lat0, lng0 + drift);
        return p ? { iso3: c.iso3, ...p } : null;
      }).filter((d): d is NonNullable<typeof d> => d !== null),
    [lat0, lng0, drift],
  );
  const graticule = useMemo(() => graticulePath(lat0, lng0 + drift), [lat0, lng0, drift]);
  const hit = dots.find((d) => d.iso3 === question.answer);
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
        className="w-full max-w-[460px] mx-auto"
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
        <circle cx="200" cy="200" r={R + 6} fill="url(#home-sphere)" />
        <path d={graticule} fill="none" stroke="#9ea7ff" strokeOpacity="0.16" strokeWidth="0.6" />
        {dots.map((d) =>
          d.iso3 === question.answer ? null : (
            <circle key={d.iso3} cx={d.x} cy={d.y} r={(1.2 + d.z * 1.4).toFixed(2)} fill="#f4f5fb" opacity={(0.1 + d.z * 0.45).toFixed(2)} />
          ),
        )}
        <circle cx="200" cy="200" r={R + 6} fill="url(#home-shade)" />
        <circle cx="200" cy="200" r={R + 6} fill="none" stroke="#00d4ff" strokeOpacity="0.28" strokeWidth="1" />
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
            <circle cx={hit.x} cy={hit.y} r={11} fill="var(--violet)" fillOpacity="0.25" />
            <circle cx={hit.x} cy={hit.y} r={6} fill="#a5a0ff" />
          </g>
        )}
      </svg>

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
