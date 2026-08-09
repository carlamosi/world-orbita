import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { u as useLiveQuery } from '../_libs/dexie-react-hooks.mjs';
import { A as ALL_SKILLS, d as db } from './orbita-db-Bdp3ClIj.mjs';
import { s as spring, B as Badge, C as COUNTRIES, b as COUNTRY_BY_ISO3 } from './motion-B8-Vl7RP.mjs';
import { F as FlagImage } from './FlagImage-X1rCgo2Q.mjs';
import { d as dateKey, r as retrievability, c as currentStreak, l as longestStreak, D as DEFINITIONS } from './unlocks-Bp4r3G0f.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import '../_libs/dexie.mjs';
import '../_libs/sonner.mjs';
import { m as motion } from '../_libs/framer-motion.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
import '../_libs/tanstack__react-router.mjs';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import 'node:stream';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import '../_libs/clsx.mjs';
import '../_libs/tailwind-merge.mjs';
import './client-CnjuyyaV.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
import '../_libs/radix-ui__react-dropdown-menu.mjs';
import '../_libs/radix-ui__primitive.mjs';
import '../_libs/radix-ui__react-compose-refs.mjs';
import '../_libs/radix-ui__react-context.mjs';
import '../_libs/@radix-ui/react-use-controllable-state+[...].mjs';
import '../_libs/@radix-ui/react-use-layout-effect+[...].mjs';
import '../_libs/radix-ui__react-primitive.mjs';
import '../_libs/radix-ui__react-slot.mjs';
import '../_libs/radix-ui__react-menu.mjs';
import '../_libs/radix-ui__react-collection.mjs';
import '../_libs/radix-ui__react-direction.mjs';
import '../_libs/@radix-ui/react-dismissable-layer+[...].mjs';
import '../_libs/@radix-ui/react-use-callback-ref+[...].mjs';
import '../_libs/@radix-ui/react-use-escape-keydown+[...].mjs';
import '../_libs/radix-ui__react-focus-guards.mjs';
import '../_libs/radix-ui__react-focus-scope.mjs';
import '../_libs/radix-ui__react-popper.mjs';
import '../_libs/floating-ui__react-dom.mjs';
import '../_libs/floating-ui__dom.mjs';
import '../_libs/floating-ui__core.mjs';
import '../_libs/floating-ui__utils.mjs';
import '../_libs/radix-ui__react-arrow.mjs';
import '../_libs/radix-ui__react-use-size.mjs';
import '../_libs/radix-ui__react-portal.mjs';
import '../_libs/radix-ui__react-presence.mjs';
import '../_libs/radix-ui__react-roving-focus.mjs';
import '../_libs/radix-ui__react-id.mjs';
import '../_libs/aria-hidden.mjs';
import '../_libs/react-remove-scroll.mjs';
import '../_libs/react-remove-scroll-bar.mjs';
import '../_libs/react-style-singleton.mjs';
import '../_libs/get-nonce.mjs';
import '../_libs/use-sidecar.mjs';
import '../_libs/use-callback-ref.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/zustand.mjs';

const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
function ProgressPage() {
  const conceptProgress = useLiveQuery(() => db().concept_progress.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const unlocks = useLiveQuery(() => db().unlocks.toArray(), []) ?? [];
  const activeDays = reactExports.useMemo(
    () => new Set(sessions.map((s) => dateKey(s.createdAt))),
    [sessions]
  );
  const totalAnswered = sessions.reduce((a, s) => a + s.totalQuestions, 0);
  const minutes = Math.round(sessions.reduce((a, s) => a + s.durationMs, 0) / 6e4);
  const mastered = reactExports.useMemo(() => {
    const byIso = /* @__PURE__ */ new Map();
    const byIsoMastered = /* @__PURE__ */ new Map();
    for (const p of conceptProgress) {
      if (p.fsrs_state === "new") continue;
      byIso.set(p.iso3, (byIso.get(p.iso3) ?? 0) + 1);
      const elapsedDays = Math.max(0, (Date.now() - p.fsrs_last_review) / 864e5);
      const r = p.fsrs_stability ? retrievability(p.fsrs_stability, elapsedDays) : 0;
      if (r >= 0.8) {
        byIsoMastered.set(p.iso3, (byIsoMastered.get(p.iso3) ?? 0) + 1);
      }
    }
    let count = 0;
    for (const [iso, total] of byIso.entries()) {
      if (total >= 3 && byIsoMastered.get(iso) === total) count++;
    }
    return count;
  }, [conceptProgress]);
  const cs = currentStreak(activeDays);
  const ls = longestStreak(activeDays);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-dvh pt-24 pb-16 px-4 sm:px-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-6xl", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.header,
      {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: spring.soft,
        className: "mb-8",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "cyan", children: "Mastery dashboard" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-3 font-display text-4xl text-white tracking-tight text-glow-violet", children: "Your orbit so far" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-white/55 text-[15px]", children: "Real numbers from real sessions. Everything lives in your browser." })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(HeroStat, { label: "Mastered", value: mastered, sub: `of ${COUNTRIES.length}` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(HeroStat, { label: "Answered", value: totalAnswered }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(HeroStat, { label: "Sessions", value: sessions.length }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(HeroStat, { label: "Streak", value: `${cs}d`, sub: `best ${ls}d` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(HeroStat, { label: "Minutes", value: minutes })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "mt-10", children: /* @__PURE__ */ jsxRuntimeExports.jsx(MasteryStability, { progress: conceptProgress }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { children: "Confidence map" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ConfidenceMap, { progress: conceptProgress })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "mt-10 grid lg:grid-cols-2 gap-4", children: ALL_SKILLS.map((skill) => /* @__PURE__ */ jsxRuntimeExports.jsx(SkillPanel, { skill, progress: conceptProgress }, skill)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { children: "Unlocks" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-3", children: DEFINITIONS.map((d) => {
        const u = unlocks.find((x) => x.key === d.key);
        const unlocked = u?.unlockedAt != null;
        const pct = Math.round((u?.progress ?? 0) * 100);
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: cn(
              "glass rounded-2xl p-4 transition-all",
              unlocked && "border-[color:var(--neon)]/40 shadow-[0_0_30px_-10px_color-mix(in_oklab,var(--neon)_60%,transparent)]"
            ),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-base text-white tracking-tight", children: d.title }),
                unlocked ? /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "neon", children: "Unlocked" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-[11px] text-white/45", children: [
                  pct,
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[12px] text-white/55", children: d.description }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "h-full",
                  style: {
                    width: `${Math.max(2, pct)}%`,
                    background: unlocked ? "var(--neon)" : "var(--cyan)"
                  }
                }
              ) })
            ]
          },
          d.key
        );
      }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { children: "Recent sessions" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "glass rounded-2xl overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "text-left text-white/45 font-mono text-[11px] uppercase tracking-wider", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2", children: "When" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2", children: "Mode" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2", children: "Skill" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right", children: "Score" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right", children: "Acc" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          sessions.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 15).map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-t border-white/5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-white/70", children: relTime(s.createdAt) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-white", children: s.mode }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-white/70", children: s.skill }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right text-white", children: s.score }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right text-white/70", children: s.totalQuestions > 0 ? `${Math.round(s.correct / s.totalQuestions * 100)}%` : "—" })
          ] }, s.id)),
          sessions.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 5, className: "px-4 py-6 text-center text-white/45", children: "No sessions yet — play one round and come back." }) })
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { children: "By continent" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-3", children: CONTINENTS.map((cont) => {
        const list = COUNTRIES.filter((c) => c.continent === cont);
        const grouped = /* @__PURE__ */ new Map();
        for (const p of conceptProgress) {
          if (p.fsrs_state === "new") continue;
          const arr = grouped.get(p.iso3) || [];
          const r = p.fsrs_stability ? retrievability(p.fsrs_stability, Math.max(0, (Date.now() - p.fsrs_last_review) / 864e5)) : 0;
          arr.push(r);
          grouped.set(p.iso3, arr);
        }
        let masteredCount = 0;
        for (const c of list) {
          const rs = grouped.get(c.iso3) || [];
          if (rs.length >= 3 && rs.every((r) => r >= 0.8)) {
            masteredCount++;
          }
        }
        const pct = list.length > 0 ? masteredCount / list.length : 0;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl p-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-white", children: cont }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-mono text-[11px] text-white/45 mt-1", children: [
            masteredCount,
            "/",
            list.length
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "h-full",
              style: {
                width: `${Math.max(2, pct * 100)}%`,
                background: pct >= 0.8 ? "var(--neon)" : pct >= 0.4 ? "var(--cyan)" : "var(--violet)"
              }
            }
          ) })
        ] }, cont);
      }) })
    ] })
  ] }) });
}
function MasteryStability({
  progress
}) {
  const now = Date.now();
  const metrics = reactExports.useMemo(() => {
    let totalSeen = 0;
    let active = 0;
    let dueToday = 0;
    let overdue = 0;
    let retentionSum = 0;
    let retentionCount = 0;
    const perSkill = /* @__PURE__ */ new Map();
    for (const sk of ALL_SKILLS)
      perSkill.set(sk, {
        seen: 0,
        due: 0,
        overdue: 0,
        retSum: 0,
        retCount: 0,
        intervalSum: 0,
        intervalCount: 0
      });
    for (const row of progress) {
      if (row.fsrs_state === "new") continue;
      const sk = row.skill;
      const p = perSkill.get(sk);
      if (!p) continue;
      totalSeen++;
      p.seen++;
      let r = 0;
      if (row.fsrs_state === "review" && row.fsrs_stability) {
        const elapsedDays = Math.max(0, (now - row.fsrs_last_review) / 864e5);
        r = retrievability(row.fsrs_stability, elapsedDays);
        p.intervalSum += row.fsrs_stability;
        p.intervalCount++;
        if (row.fsrs_reps >= 2 && row.fsrs_due > now) active++;
        if (row.fsrs_due <= now) {
          dueToday++;
          p.due++;
          if (now - row.fsrs_due > 864e5) {
            overdue++;
            p.overdue++;
          }
        }
      } else {
        r = 0.1;
        if (row.fsrs_due <= now) {
          dueToday++;
          p.due++;
        }
      }
      retentionSum += r;
      retentionCount++;
      p.retSum += r;
      p.retCount++;
    }
    return {
      totalSeen,
      active,
      dueToday,
      overdue,
      retention: retentionCount > 0 ? retentionSum / retentionCount : 0,
      stability: totalSeen > 0 ? active / totalSeen : 0,
      perSkill
    };
  }, [progress, now]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-strong rounded-3xl p-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "neon", children: "Spaced repetition" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-2 font-display text-2xl text-white tracking-tight text-glow-violet", children: "Mastery stability" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[13px] text-white/55", children: "Long-term retention from SM-2 spaced repetition. Higher = items are sticking; due/overdue = ready for review." })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-5 grid grid-cols-2 md:grid-cols-4 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StabilityStat,
        {
          label: "Retention",
          value: `${Math.round(metrics.retention * 100)}%`,
          tone: metrics.retention >= 0.8 ? "neon" : metrics.retention >= 0.5 ? "cyan" : "coral"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StabilityStat,
        {
          label: "Stable items",
          value: `${Math.round(metrics.stability * 100)}%`,
          sub: `${metrics.active}/${metrics.totalSeen}`
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StabilityStat,
        {
          label: "Due today",
          value: String(metrics.dueToday),
          tone: metrics.dueToday > 0 ? "cyan" : void 0
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StabilityStat,
        {
          label: "Overdue",
          value: String(metrics.overdue),
          tone: metrics.overdue > 0 ? "coral" : void 0
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45 mb-2", children: "Per skill" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2", children: ALL_SKILLS.map((sk) => {
        const p = metrics.perSkill.get(sk);
        const r = p.retCount > 0 ? p.retSum / p.retCount : 0;
        const avgInt = p.intervalCount > 0 ? p.intervalSum / p.intervalCount : 0;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl p-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-white capitalize", children: sk }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-[11px] text-white/55", children: [
              p.seen,
              " seen"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "h-full",
              style: {
                width: `${Math.max(2, r * 100)}%`,
                background: r >= 0.8 ? "var(--neon)" : r >= 0.5 ? "var(--cyan)" : "var(--coral)"
              }
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-white/45", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              Math.round(r * 100),
              "% retain"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              p.due,
              " due · ",
              p.overdue,
              " overdue"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "~",
              avgInt.toFixed(1),
              "d"
            ] })
          ] })
        ] }, sk);
      }) })
    ] })
  ] });
}
function StabilityStat({
  label,
  value,
  sub,
  tone
}) {
  const color = tone === "neon" ? "text-[color:var(--neon)]" : tone === "cyan" ? "text-[color:var(--cyan)]" : tone === "coral" ? "text-[color:var(--coral)]" : "text-white";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("mt-1 font-display text-2xl tracking-tight", color), children: value }),
    sub && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 font-mono text-[10px] text-white/45", children: sub })
  ] });
}
function SectionTitle({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[11px] uppercase tracking-[0.3em] text-white/45 mb-3", children });
}
function HeroStat({
  label,
  value,
  sub
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-strong rounded-2xl p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 font-display text-3xl text-white tracking-tight text-glow-violet", children: value }),
    sub && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] text-white/45 mt-1", children: sub })
  ] });
}
function ConfidenceMap({ progress }) {
  const grouped = /* @__PURE__ */ new Map();
  for (const p of progress) {
    if (p.fsrs_state === "new") continue;
    const r = p.fsrs_stability ? retrievability(p.fsrs_stability, Math.max(0, (Date.now() - p.fsrs_last_review) / 864e5)) : 0.1;
    const arr = grouped.get(p.iso3) || [];
    arr.push(r);
    grouped.set(p.iso3, arr);
  }
  const cells = COUNTRIES.map((c) => {
    const rs = grouped.get(c.iso3) || [];
    const avg = rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
    return { c, avg };
  }).sort((a, b) => {
    if (a.c.continent !== b.c.continent) return a.c.continent.localeCompare(b.c.continent);
    return a.c.name.localeCompare(b.c.name);
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1", children: cells.map(({ c, avg }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        title: `${c.name} · ${Math.round(avg * 100)}%`,
        className: "aspect-square rounded-[4px]",
        style: {
          background: avg <= 0 ? "rgba(255,255,255,0.04)" : `color-mix(in oklab, ${avg >= 0.8 ? "var(--neon)" : avg >= 0.4 ? "var(--cyan)" : "var(--coral)"} ${Math.round(20 + avg * 70)}%, transparent)`
        }
      },
      c.iso3
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-white/45", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Cold" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-2 rounded-sm bg-[color:var(--coral)]/60" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-2 rounded-sm bg-[color:var(--cyan)]/60" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-2 rounded-sm bg-[color:var(--neon)]/70" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Mastered" })
    ] })
  ] });
}
function SkillPanel({
  skill,
  progress
}) {
  const rows = progress.filter((p) => p.skill === skill && p.fsrs_state !== "new").map((p) => {
    const r = p.fsrs_stability ? retrievability(p.fsrs_stability, Math.max(0, (Date.now() - p.fsrs_last_review) / 864e5)) : 0.1;
    return { iso3: p.iso3, r };
  });
  const sorted = rows.slice().sort((a, b) => a.r - b.r);
  const weakest = sorted.slice(0, 5);
  const strongest = sorted.slice(-5).reverse();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-lg text-white capitalize", children: skill }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { tone: "muted", children: [
        rows.length,
        " seen"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 grid grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-wider text-white/45 mb-1", children: "Strongest" }),
        strongest.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-white/45 text-sm", children: "—" }),
        strongest.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsx(CountryRow, { iso3: r.iso3, pct: Math.round(r.r * 100) }, r.iso3))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-wider text-white/45 mb-1", children: "Needs work" }),
        weakest.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-white/45 text-sm", children: "—" }),
        weakest.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsx(CountryRow, { iso3: r.iso3, pct: Math.round(r.r * 100) }, r.iso3))
      ] })
    ] })
  ] });
}
function CountryRow({ iso3, pct }) {
  const c = COUNTRY_BY_ISO3.get(iso3);
  if (!c) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 py-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: c.iso2, alt: c.name, className: "w-5 h-3.5 rounded-sm shrink-0" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-white/85 text-[13px] truncate", children: c.name })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-[11px] text-white/55", children: [
      pct,
      "%"
    ] })
  ] });
}
function relTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 6e4);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export { ProgressPage as default };
