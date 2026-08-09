import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { u as useLiveQuery } from '../_libs/dexie-react-hooks.mjs';
import { d as db } from './orbita-db-Bdp3ClIj.mjs';
import { d as dateKey, w as weekKey } from './unlocks-Bp4r3G0f.mjs';
import { a as selectMixedQuestions, c as confidenceAfter } from './mastery-XPzQDsTf.mjs';
import { B as Badge, p as pickRandomCountries, s as spring } from './motion-B8-Vl7RP.mjs';
import { B as Button } from './orbita-button-CKjnWSTu.mjs';
import { F as FlagImage } from './FlagImage-X1rCgo2Q.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import { r as recordSessionEnd, a as updateSkillProgress, u as useSkipHotkey } from './useSkipHotkey-DYRLIO3y.mjs';
import { u as useAnswerHotkeys } from './useAnswerHotkeys-7pgBdxjU.mjs';
import { u as useAutoAdvance } from './useAutoAdvance-Da90vNd_.mjs';
import '../_libs/dexie.mjs';
import '../_libs/sonner.mjs';
import { m as motion, A as AnimatePresence } from '../_libs/framer-motion.mjs';
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
import './clientId-B0Bcj0A6.mjs';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
async function generateDaily(now = Date.now()) {
  const key = dateKey(now);
  const rng = mulberry32(hashString(`daily:${key}`));
  const items = await selectMixedQuestions(
    10,
    ["name", "flag", "capital", "location"],
    { rng }
  );
  return { kind: "daily", periodKey: key, count: items.length, items };
}
async function generateWeekly(now = Date.now()) {
  const key = weekKey(now);
  const rng = mulberry32(hashString(`weekly:${key}`));
  const items = await selectMixedQuestions(
    25,
    ["name", "flag", "capital", "location"],
    { rng }
  );
  return { kind: "weekly", periodKey: key, count: items.length, items };
}

function ChallengesPage() {
  const [daily, setDaily] = reactExports.useState(null);
  const [weekly, setWeekly] = reactExports.useState(null);
  const [active, setActive] = reactExports.useState(null);
  reactExports.useEffect(() => {
    generateDaily().then(setDaily);
    generateWeekly().then(setWeekly);
  }, []);
  const todayKey = dateKey();
  const thisWeekKey = weekKey();
  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const dailyBest = reactExports.useMemo(
    () => sessions.filter((s) => s.mode === "challenge_daily" && s.periodKey === todayKey).reduce((m, s) => Math.max(m, s.score), 0),
    [sessions, todayKey]
  );
  const weeklyBest = reactExports.useMemo(
    () => sessions.filter((s) => s.mode === "challenge_weekly" && s.periodKey === thisWeekKey).reduce((m, s) => Math.max(m, s.score), 0),
    [sessions, thisWeekKey]
  );
  if (active) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      ChallengeRunner,
      {
        active,
        setActive,
        onExit: () => setActive(null)
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-dvh pt-24 pb-16 px-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-5xl", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "mb-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "violet", children: "Challenges" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-3 font-display text-4xl text-white tracking-tight text-glow-violet", children: "Today's orbit" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-white/55 text-[15px]", children: "Deterministic question sets — everyone gets the same daily run." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ChallengeCard,
        {
          kind: "daily",
          set: daily,
          best: dailyBest,
          onStart: (set) => setActive({
            set,
            index: 0,
            correct: 0,
            wrong: 0,
            score: 0,
            combo: 0,
            bestCombo: 0,
            startedAt: Date.now(),
            answerState: "idle"
          })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ChallengeCard,
        {
          kind: "weekly",
          set: weekly,
          best: weeklyBest,
          onStart: (set) => setActive({
            set,
            index: 0,
            correct: 0,
            wrong: 0,
            score: 0,
            combo: 0,
            bestCombo: 0,
            startedAt: Date.now(),
            answerState: "idle"
          })
        }
      )
    ] })
  ] }) });
}
function ChallengeCard({
  kind,
  set,
  best,
  onStart
}) {
  const title = kind === "daily" ? "Daily 10" : "Weekly 25";
  const sub = kind === "daily" ? dateKey() : weekKey();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0 },
      transition: spring.soft,
      className: "glass-strong rounded-3xl p-6 flex flex-col",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: kind === "daily" ? "cyan" : "neon", children: kind }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-[11px] text-white/45", children: sub })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 font-display text-2xl text-white tracking-tight", children: title }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-2 text-white/55 text-[14px]", children: [
          "Mixed-skill rapid round. Same questions for everyone, every ",
          kind === "daily" ? "day" : "week",
          "."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-wider text-white/55", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-xl p-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "Questions" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-lg text-white tracking-tight", children: set?.count ?? "…" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-xl p-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "Your best" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-lg text-white tracking-tight", children: best })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 flex justify-end", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: () => set && onStart(set), disabled: !set, children: [
          best > 0 ? "Replay" : "Start",
          " →"
        ] }) })
      ]
    }
  );
}
function ChallengeRunner({
  active,
  setActive,
  onExit
}) {
  const finished = active.index >= active.set.items.length;
  const current = active.set.items[active.index];
  const options = reactExports.useMemo(() => {
    if (!current) return [];
    const others = pickRandomCountries(3, /* @__PURE__ */ new Set([current.country.iso3]));
    return shuffle([current.country, ...others]);
  }, [current]);
  reactExports.useEffect(() => {
    if (!finished || active.answerState !== "idle") return;
    const endedAt = Date.now();
    recordSessionEnd({
      mode: active.set.kind === "daily" ? "challenge_daily" : "challenge_weekly",
      skill: "mixed",
      score: active.score,
      totalQuestions: active.set.items.length,
      correct: active.correct,
      wrong: active.wrong,
      bestCombo: active.bestCombo,
      durationMs: endedAt - active.startedAt,
      createdAt: endedAt,
      periodKey: active.set.periodKey
    });
  }, [finished]);
  if (finished) {
    const acc = active.set.items.length > 0 ? Math.round(active.correct / active.set.items.length * 100) : 0;
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-dvh pt-28 px-6 pb-16 flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        initial: { opacity: 0, y: 16, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: spring.soft,
        className: "glass-strong rounded-3xl p-10 max-w-md w-full text-center",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "neon", children: "Challenge complete" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 font-display text-5xl text-white tracking-tight text-glow-violet", children: active.score }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-white/60 text-sm", children: [
            active.correct,
            "/",
            active.set.items.length,
            " · ",
            acc,
            "% accuracy"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-8 flex gap-3 justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: onExit, children: "Back" }) })
        ]
      }
    ) });
  }
  const pick = reactExports.useCallback(
    (iso3) => {
      if (!current || active.answerState !== "idle") return;
      const correctPick = iso3 === current.country.iso3;
      updateSkillProgress(
        current.country.iso3,
        current.skill,
        (prev) => confidenceAfter(prev, correctPick)
      );
      const combo = correctPick ? active.combo + 1 : 0;
      const gained = correctPick ? 100 + Math.min(combo - 1, 9) * 20 : 0;
      setActive({
        ...active,
        answerState: correctPick ? "correct" : "wrong",
        score: active.score + gained,
        combo,
        bestCombo: Math.max(active.bestCombo, combo),
        correct: active.correct + (correctPick ? 1 : 0),
        wrong: active.wrong + (correctPick ? 0 : 1)
      });
    },
    [active, current, setActive]
  );
  const next = reactExports.useCallback(() => {
    setActive({ ...active, index: active.index + 1, answerState: "idle" });
  }, [active, setActive]);
  const hotkeyItems = reactExports.useMemo(
    () => current && active.answerState === "idle" ? options.map((o) => ({ id: o.iso3 })) : [],
    [current, options, active.answerState]
  );
  useAnswerHotkeys(hotkeyItems, pick);
  useSkipHotkey(reactExports.useCallback(() => {
    if (current && active.answerState === "idle") {
      setActive({ ...active, answerState: "wrong", wrong: active.wrong + 1, combo: 0 });
    }
  }, [current, active, setActive]));
  useAutoAdvance({
    answerState: active.answerState === "wrong" ? "wrong" : active.answerState === "correct" ? "correct" : "idle",
    finished: false,
    next
  });
  if (!current) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-dvh pt-24 pb-10 px-6 flex flex-col items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-2xl", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { tone: active.set.kind === "daily" ? "cyan" : "neon", children: [
        active.set.kind,
        " · ",
        active.index + 1,
        "/",
        active.set.items.length
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Button,
        {
          variant: "secondary",
          size: "sm",
          onClick: onExit,
          "aria-label": "Exit challenge",
          children: "✕ Exit"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.div,
      {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        transition: spring.crisp,
        className: "mt-4 glass-strong rounded-2xl p-6 text-center",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(PromptInline, { item: current })
      },
      active.index
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 grid grid-cols-2 gap-3", children: options.map((o, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        disabled: active.answerState !== "idle",
        onClick: () => pick(o.iso3),
        className: cn(
          "glass rounded-2xl p-4 text-left transition-all duration-150",
          "hover:-translate-y-0.5 hover:border-white/25 disabled:opacity-60 disabled:hover:translate-y-0",
          active.answerState !== "idle" && o.iso3 === current.country.iso3 && "border-[color:var(--neon)]/60 shadow-[0_0_40px_-10px_color-mix(in_oklab,var(--neon)_60%,transparent)]"
        ),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/40", children: i + 1 }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 flex items-center gap-3", children: [
            current.skill === "flag" && /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: o.iso2, alt: o.name, className: "w-12 h-8 shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-base text-white tracking-tight truncate", children: current.skill === "capital" ? o.capital ?? "—" : o.name })
          ] })
        ]
      },
      o.iso3
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: active.answerState !== "idle" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 10 },
        className: "mt-6 glass-strong rounded-2xl p-4 flex items-center justify-between",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45", children: active.answerState === "correct" ? "Nailed it" : "Not quite" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-display text-lg text-white", children: [
              current.country.name,
              " — ",
              current.country.capital ?? "—"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", onClick: next, children: "Next →" })
        ]
      }
    ) })
  ] }) });
}
function PromptInline({ item }) {
  const { country, skill } = item;
  if (skill === "name") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45", children: "Name this flag" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 flex justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: country.iso2, alt: "flag", className: "w-40 aspect-[3/2]" }) })
    ] });
  }
  if (skill === "flag") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45", children: "Which flag" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 font-display text-2xl text-white text-glow-cyan", children: country.name })
    ] });
  }
  if (skill === "capital") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45", children: "Capital of" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 font-display text-2xl text-white text-glow-cyan", children: country.name })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45", children: "Country with capital" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 font-display text-2xl text-white text-glow-cyan", children: country.capital ?? "—" })
  ] });
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { ChallengesPage as default };
