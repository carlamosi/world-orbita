import { j as jsxRuntimeExports, r as reactExports } from '../_libs/react.mjs';
import { a as selectMixedQuestions } from './mastery-XPzQDsTf.mjs';
import { u as useSkipHotkey, r as recordSessionEnd } from './useSkipHotkey-DYRLIO3y.mjs';
import { g as getConceptProgress, a as assess, r as recordConceptAttempt, u as useContinentPref, C as ContinentSelect } from './ContinentSelect-nxtEY6fc.mjs';
import { u as updateFsrs } from './unlocks-Bp4r3G0f.mjs';
import { B as Button } from './orbita-button-CKjnWSTu.mjs';
import { s as spring, B as Badge } from './motion-B8-Vl7RP.mjs';
import { F as FlagImage } from './FlagImage-X1rCgo2Q.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import '../_libs/dexie.mjs';
import '../_libs/sonner.mjs';
import { c as create } from '../_libs/zustand.mjs';
import { m as motion, A as AnimatePresence } from '../_libs/framer-motion.mjs';
import { F as Flag, i as MapPin, T as Type, G as Globe, S as Skull, j as Timer, Z as Zap } from '../_libs/lucide-react.mjs';
import './orbita-db-Bdp3ClIj.mjs';
import './clientId-B0Bcj0A6.mjs';
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

const SPRINT_MS = 6e4;
const MARATHON_MS = 12e4;
const TICK_MS = 250;
function modeDurationMs(m) {
  if (m === "sprint60") return SPRINT_MS;
  if (m === "marathon120") return MARATHON_MS;
  return Number.POSITIVE_INFINITY;
}
function startingLives(m) {
  return m === "suddenDeath" ? 3 : Infinity;
}
let tickHandle = null;
const pendingTimeouts = /* @__PURE__ */ new Set();
let currentStartToken = 0;
function clearAllTimers() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  for (const t of pendingTimeouts) clearTimeout(t);
  pendingTimeouts.clear();
}
function invalidateStart() {
  currentStartToken++;
}
function makeOptions(target, all) {
  const pool = all.filter((c) => c.iso3 !== target.iso3);
  const out = [target];
  while (out.length < 4) {
    const cand = pool[Math.floor(Math.random() * pool.length)];
    if (!out.includes(cand)) out.push(cand);
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const INITIAL_STATE = {
  status: "idle",
  queue: [],
  index: 0,
  timeRemainingMs: SPRINT_MS,
  score: 0,
  combo: 0,
  bestCombo: 0,
  lives: Infinity,
  correct: 0,
  wrong: 0,
  startedAt: 0,
  endedAt: null
};
const useSpeedRuntime = create((set, get) => ({
  config: { mode: "sprint60", continent: "All" },
  ...INITIAL_STATE,
  setConfig(patch) {
    const next = { ...get().config, ...patch };
    clearAllTimers();
    invalidateStart();
    set({
      config: next,
      ...INITIAL_STATE,
      timeRemainingMs: modeDurationMs(next.mode),
      lives: startingLives(next.mode)
    });
  },
  async start(modeOverride) {
    invalidateStart();
    clearAllTimers();
    const token = currentStartToken;
    const config = modeOverride ? { ...get().config, mode: modeOverride } : get().config;
    set({
      config,
      ...INITIAL_STATE,
      timeRemainingMs: modeDurationMs(config.mode),
      lives: startingLives(config.mode)
    });
    const { COUNTRIES } = await import('./motion-B8-Vl7RP.mjs').then(n => n.c);
    const picks = await selectMixedQuestions(
      80,
      ["name", "flag", "capital", "location"],
      { continent: config.continent === "All" ? void 0 : config.continent }
    );
    const now = Date.now();
    const queue = picks.map((p) => ({
      country: p.country,
      skill: p.skill,
      options: makeOptions(p.country, COUNTRIES),
      shownAt: now
    }));
    if (token !== currentStartToken) return;
    set({
      status: "running",
      queue,
      index: 0,
      timeRemainingMs: modeDurationMs(config.mode),
      score: 0,
      combo: 0,
      bestCombo: 0,
      lives: startingLives(config.mode),
      correct: 0,
      wrong: 0,
      startedAt: now,
      endedAt: null
    });
    if (Number.isFinite(modeDurationMs(config.mode))) {
      const startedAt = now;
      const total = modeDurationMs(config.mode);
      tickHandle = setInterval(() => {
        if (useSpeedRuntime.getState().status !== "running") {
          clearAllTimers();
          return;
        }
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, total - elapsed);
        if (remaining <= 0) {
          finalize();
          return;
        }
        useSpeedRuntime.setState({ timeRemainingMs: remaining });
      }, TICK_MS);
    }
  },
  answer(iso3) {
    const s = get();
    if (s.status !== "running") return;
    const item = s.queue[s.index];
    if (!item) return;
    const isCorrect = item.country.iso3 === iso3;
    const responseMs = Math.max(0, Date.now() - item.shownAt);
    const now = Date.now();
    getConceptProgress(`${item.country.iso3}:${item.skill}`).then((targetConcept) => {
      if (!targetConcept) return;
      const overdueMs = Math.max(0, now - targetConcept.fsrs_due);
      const grade = assess({
        validationResult: { correct: isCorrect, softCorrect: false },
        responseMs,
        attemptNumber: 1,
        hintsUsed: 0,
        questionType: item.skill,
        overdueMs
      });
      const currentFsrs = {
        state: targetConcept.fsrs_state,
        stability: targetConcept.fsrs_stability,
        difficulty: targetConcept.fsrs_difficulty,
        due: targetConcept.fsrs_due,
        lastReviewAt: targetConcept.fsrs_last_review,
        reps: targetConcept.fsrs_reps,
        lapses: targetConcept.fsrs_lapses,
        learningStep: 0,
        lastGrade: null
      };
      const nextFsrs = updateFsrs(currentFsrs, grade, now);
      recordConceptAttempt({
        ...targetConcept,
        fsrs_state: nextFsrs.state,
        fsrs_stability: nextFsrs.stability,
        fsrs_difficulty: nextFsrs.difficulty,
        fsrs_due: nextFsrs.due,
        fsrs_last_review: nextFsrs.lastReviewAt,
        fsrs_reps: nextFsrs.reps,
        fsrs_lapses: nextFsrs.lapses,
        version: targetConcept.version + 1,
        dirty: 1,
        updated_at: now
      }, {
        op_id: crypto.randomUUID(),
        conceptId: targetConcept.conceptId,
        sessionId: "speed-" + s.startedAt,
        grade,
        responseMs,
        correct: isCorrect,
        answeredAt: now
      }).catch(console.error);
    });
    if (isCorrect) {
      const combo = s.combo + 1;
      const mult = Math.min(5, 1 + Math.floor((combo - 1) / 3));
      const gained = 10 * mult;
      set({
        score: s.score + gained,
        combo,
        bestCombo: Math.max(s.bestCombo, combo),
        correct: s.correct + 1,
        index: s.index + 1
      });
    } else {
      const lives = Number.isFinite(s.lives) ? s.lives - 1 : Infinity;
      set({
        combo: 0,
        wrong: s.wrong + 1,
        lives,
        index: s.index + 1
      });
      if (lives <= 0) {
        finalize();
        return;
      }
    }
    const newIdx = get().index;
    const newItem = get().queue[newIdx];
    if (newItem && newItem.shownAt === 0) {
      const next = get().queue.slice();
      next[newIdx] = { ...newItem, shownAt: Date.now() };
      useSpeedRuntime.setState({ queue: next });
    } else if (newItem) {
      const next = get().queue.slice();
      next[newIdx] = { ...newItem, shownAt: Date.now() };
      useSpeedRuntime.setState({ queue: next });
    }
    if (get().index >= get().queue.length - 4) {
      void topUpQueue();
    }
  },
  skip() {
    const s = get();
    if (s.status !== "running") return;
    if (!s.queue[s.index]) return;
    set({ combo: 0, wrong: s.wrong + 1, index: s.index + 1 });
    if (get().index >= get().queue.length - 4) {
      void topUpQueue();
    }
  },
  reset() {
    clearAllTimers();
    invalidateStart();
    const cfg = get().config;
    set({
      ...INITIAL_STATE,
      timeRemainingMs: modeDurationMs(cfg.mode),
      lives: startingLives(cfg.mode)
    });
  }
}));
async function topUpQueue() {
  const s = useSpeedRuntime.getState();
  const { COUNTRIES } = await import('./motion-B8-Vl7RP.mjs').then(n => n.c);
  const more = await selectMixedQuestions(
    40,
    ["name", "flag", "capital", "location"],
    { continent: s.config.continent }
  );
  const now = Date.now();
  useSpeedRuntime.setState({
    queue: [
      ...s.queue,
      ...more.map((p) => ({
        country: p.country,
        skill: p.skill,
        options: makeOptions(p.country, COUNTRIES),
        shownAt: now
      }))
    ]
  });
}
function finalize() {
  clearAllTimers();
  const s = useSpeedRuntime.getState();
  if (s.status !== "running") return;
  const endedAt = Date.now();
  useSpeedRuntime.setState({ status: "ended", endedAt, timeRemainingMs: 0 });
  recordSessionEnd({
    mode: "speed",
    skill: "mixed",
    score: s.score,
    totalQuestions: s.correct + s.wrong,
    correct: s.correct,
    wrong: s.wrong,
    bestCombo: s.bestCombo,
    durationMs: endedAt - s.startedAt,
    createdAt: endedAt,
    meta: { speedMode: s.config.mode, continent: s.config.continent }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("orbita:session-end", { detail: { score: s.score } }));
  }
}

const MODE_META = {
  sprint60: {
    name: "Sprint",
    sub: "60 seconds",
    desc: "Pure speed against the clock.",
    icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Zap, { className: "w-5 h-5" })
  },
  marathon120: {
    name: "Marathon",
    sub: "2 minutes",
    desc: "Build massive combos over time.",
    icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Timer, { className: "w-5 h-5" })
  },
  suddenDeath: {
    name: "Sudden Death",
    sub: "3 lives",
    desc: "One wrong answer costs a life.",
    icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Skull, { className: "w-5 h-5" })
  }
};
const SKILL_PILLS = [
  { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Flag, { className: "w-3.5 h-3.5" }), label: "Flags" },
  { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(MapPin, { className: "w-3.5 h-3.5" }), label: "Capitals" },
  { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Type, { className: "w-3.5 h-3.5" }), label: "Name" },
  { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Globe, { className: "w-3.5 h-3.5" }), label: "Find" }
];
function SpeedPage() {
  const status = useSpeedRuntime((s) => s.status);
  const mode = useSpeedRuntime((s) => s.config.mode);
  if (status === "idle") return /* @__PURE__ */ jsxRuntimeExports.jsx(PreGame, {}, "pre");
  if (status === "ended") return /* @__PURE__ */ jsxRuntimeExports.jsx(PostGame, {}, "post");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Active, {}, `active-${mode}`);
}
function PreGame() {
  const config = useSpeedRuntime((s) => s.config);
  const setConfig = useSpeedRuntime((s) => s.setConfig);
  const start = useSpeedRuntime((s) => s.start);
  const [continent, setContinent] = useContinentPref();
  const handleContinentChange = (c) => {
    setContinent(c);
    setConfig({ continent: c === "All" ? "All" : c });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative min-h-dvh flex items-center justify-center px-4 py-16 overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        "aria-hidden": true,
        className: "pointer-events-none absolute inset-0 flex items-center justify-center",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-[700px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--violet)_18%,transparent)_0%,transparent_70%)] blur-3xl" })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        initial: { opacity: 0, y: 24, filter: "blur(10px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0)" },
        transition: spring.soft,
        className: "relative glass-strong rounded-3xl p-8 md:p-10 max-w-lg w-full z-10 flex flex-col gap-7",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "coral", children: "Speed Round" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-4 font-display text-3xl text-white tracking-tight text-glow-violet leading-tight", children: "Reflex over recall." }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-white/55 text-sm leading-relaxed", children: "Rapid-fire mixed-skill questions. Build combos for multipliers up to ×5." }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: SKILL_PILLS.map(({ icon, label }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass text-[11px] font-mono uppercase tracking-wider text-white/55 border border-white/10",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-white/40", children: icon }),
                  label
                ]
              },
              label
            )) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-3", children: "Mode" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-3 gap-2.5", children: Object.keys(MODE_META).map((m) => {
              const active = config.mode === m;
              const meta = MODE_META[m];
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => setConfig({ mode: m }),
                  "aria-pressed": active,
                  className: cn(
                    "relative flex flex-col gap-2 rounded-2xl p-4 text-left transition-all duration-200 border outline-none",
                    "focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
                    active ? [
                      "border-[color:var(--violet)]/60",
                      "bg-[color-mix(in_oklab,var(--violet)_18%,transparent)]",
                      "shadow-[0_0_32px_-8px_color-mix(in_oklab,var(--violet)_65%,transparent)]",
                      "scale-[1.02]"
                    ] : [
                      "glass border-white/10",
                      "hover:border-white/22 hover:-translate-y-0.5",
                      "hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.5)]"
                    ]
                  ),
                  children: [
                    active && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute top-2.5 right-2.5 size-1.5 rounded-full bg-[color:var(--neon)] shadow-[0_0_8px_color-mix(in_oklab,var(--neon)_90%,transparent)] animate-pulse" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: cn(
                          "transition-colors",
                          active ? "text-[color:var(--violet)]" : "text-white/40"
                        ),
                        children: meta.icon
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-sm text-white leading-tight", children: meta.name }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-wider text-white/45 mt-0.5", children: meta.sub })
                    ] })
                  ]
                },
                m
              );
            }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/40", children: "Region" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ContinentSelect, { value: continent, onChange: handleContinentChange })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => start(config.mode),
              className: cn(
                "w-full py-4 rounded-2xl font-display text-lg tracking-tight text-white transition-all duration-200 outline-none",
                "bg-[color-mix(in_oklab,var(--violet)_40%,transparent)] border border-[color:var(--violet)]/50",
                "hover:bg-[color-mix(in_oklab,var(--violet)_55%,transparent)] hover:border-[color:var(--violet)]/80",
                "hover:shadow-[0_0_40px_-10px_color-mix(in_oklab,var(--violet)_60%,transparent)] hover:-translate-y-0.5",
                "focus-visible:ring-2 focus-visible:ring-[color:var(--violet)]/60"
              ),
              children: "Start Speed Round"
            }
          )
        ]
      }
    )
  ] });
}
function Active() {
  const queue = useSpeedRuntime((s) => s.queue);
  const index = useSpeedRuntime((s) => s.index);
  const status = useSpeedRuntime((s) => s.status);
  const item = queue[index];
  const answer = useSpeedRuntime((s) => s.answer);
  const skip = useSpeedRuntime((s) => s.skip);
  const reset = useSpeedRuntime((s) => s.reset);
  reactExports.useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable))
        return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4 && item) {
        e.preventDefault();
        answer(item.options[n - 1].iso3);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [item, answer]);
  const onSkip = reactExports.useCallback(() => skip(), [skip]);
  useSkipHotkey(onSkip);
  reactExports.useEffect(() => {
    return () => {
      if (useSpeedRuntime.getState().status === "running") reset();
    };
  }, []);
  if (!item || status !== "running") return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-dvh pt-24 px-4 pb-10 flex flex-col items-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TopBar, { onExit: reset }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 w-full max-w-2xl flex flex-col items-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(PromptForItem, { item }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(OptionsGrid, { item, onPick: (iso3) => answer(iso3) })
    ] })
  ] });
}
function TopBar({ onExit }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-3xl flex items-center justify-between gap-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ScoreCombo, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TimerRing, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LivesOrEmpty, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Button,
        {
          size: "sm",
          variant: "secondary",
          onClick: onExit,
          "aria-label": "Exit Speed mode",
          className: "shrink-0",
          children: "✕ Exit"
        }
      )
    ] })
  ] });
}
function ScoreCombo() {
  const score = useSpeedRuntime((s) => s.score);
  const combo = useSpeedRuntime((s) => s.combo);
  const mult = Math.min(5, 1 + Math.floor((combo - 1) / 3));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-white/60", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between gap-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Score" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-white", children: score })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between gap-6 mt-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Combo" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: combo >= 3 ? "text-[color:var(--neon)]" : "text-white", children: [
        "×",
        combo,
        " ",
        combo >= 3 ? `(${mult}×)` : ""
      ] })
    ] })
  ] });
}
function TimerRing() {
  const ms = useSpeedRuntime((s) => s.timeRemainingMs);
  const config = useSpeedRuntime((s) => s.config);
  const isFinite = Number.isFinite(ms);
  const total = config.mode === "sprint60" ? 6e4 : config.mode === "marathon120" ? 12e4 : 1;
  const pct = isFinite ? Math.max(0, Math.min(1, ms / total)) : 1;
  const c = 2 * Math.PI * 38;
  const dash = c * pct;
  const seconds = isFinite ? Math.ceil(ms / 1e3) : 0;
  const urgent = isFinite && ms < 1e4;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "100", height: "100", viewBox: "0 0 100 100", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "circle",
        {
          cx: "50",
          cy: "50",
          r: "38",
          fill: "none",
          stroke: "rgba(255,255,255,0.08)",
          strokeWidth: "6"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "circle",
        {
          cx: "50",
          cy: "50",
          r: "38",
          fill: "none",
          stroke: urgent ? "var(--coral)" : "var(--cyan)",
          strokeWidth: "6",
          strokeLinecap: "round",
          strokeDasharray: `${dash} ${c}`,
          transform: "rotate(-90 50 50)",
          style: { transition: "stroke 200ms" }
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 grid place-items-center font-display text-2xl text-white tracking-tight", children: isFinite ? seconds : "∞" })
  ] });
}
function LivesOrEmpty() {
  const lives = useSpeedRuntime((s) => s.lives);
  const mode = useSpeedRuntime((s) => s.config.mode);
  if (mode !== "suddenDeath") return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-[140px]" });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-2xl px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-white/60 w-[140px]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-right", children: "Lives" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-end gap-1 mt-1", children: Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: cn(
          "size-3 rounded-full",
          i < lives ? "bg-[color:var(--coral)] shadow-[0_0_12px_color-mix(in_oklab,var(--coral)_70%,transparent)]" : "bg-white/10"
        )
      },
      i
    )) })
  ] });
}
function PromptForItem({ item }) {
  const { country, skill } = item;
  let title;
  let eyebrow = "";
  if (skill === "name") {
    eyebrow = "Name this flag";
    title = /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: country.iso2, alt: "flag", className: "w-48 aspect-[3/2]" });
  } else if (skill === "flag") {
    eyebrow = "Which flag";
    title = /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-glow-cyan", children: country.name });
  } else if (skill === "capital") {
    eyebrow = "Capital of";
    title = /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-glow-cyan", children: country.name });
  } else {
    eyebrow = "Country with capital";
    title = /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-glow-cyan", children: country.capital ?? "—" });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: -10, scale: 0.96 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: spring.crisp,
      className: "glass-strong rounded-2xl px-6 py-5 text-center w-full",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45", children: eyebrow }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 font-display text-2xl text-white tracking-tight flex justify-center", children: title })
      ]
    },
    country.iso3 + skill
  );
}
function OptionsGrid({
  item,
  onPick
}) {
  const flash = useFlash(item.country.iso3);
  const isFlagSkill = item.skill === "flag";
  if (isFlagSkill) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full", children: item.options.map((o, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => {
          flash(o.iso3 === item.country.iso3);
          onPick(o.iso3);
        },
        className: cn(
          "group relative aspect-[3/2] rounded-2xl overflow-hidden transition-transform duration-150",
          "hover:scale-[1.03] shadow-[0_16px_40px_-18px_rgba(0,0,0,0.7)]",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60"
        ),
        "aria-label": `Option ${i + 1}`,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: o.iso2, alt: "flag option", className: "absolute inset-0 rounded-none" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute top-1.5 left-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white bg-black/60 rounded-full px-1.5 py-0.5", children: i + 1 })
        ]
      },
      o.iso3
    )) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 grid grid-cols-2 gap-3 w-full", children: item.options.map((o, i) => {
    const showCapital = item.skill === "capital";
    const label = showCapital ? o.capital ?? "—" : o.name;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => {
          flash(o.iso3 === item.country.iso3);
          onPick(o.iso3);
        },
        className: cn(
          "glass rounded-2xl p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60"
        ),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/40", children: i + 1 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 font-display text-base text-white tracking-tight truncate", children: label })
        ]
      },
      o.iso3
    );
  }) });
}
function useFlash(_key) {
  const elRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!elRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60;opacity:0;transition:opacity 180ms";
      document.body.appendChild(el);
      elRef.current = el;
    }
    return () => {
      elRef.current?.remove();
      elRef.current = null;
    };
  }, []);
  return (correct) => {
    const el = elRef.current;
    if (!el) return;
    el.style.background = correct ? "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--neon) 28%, transparent), transparent 60%)" : "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--coral) 30%, transparent), transparent 60%)";
    el.style.opacity = "1";
    setTimeout(() => {
      el.style.opacity = "0";
    }, 140);
  };
}
function PostGame() {
  const s = useSpeedRuntime();
  const accuracy = s.correct + s.wrong > 0 ? Math.round(s.correct / (s.correct + s.wrong) * 100) : 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-dvh pt-28 px-6 pb-16 flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: 24, scale: 0.96 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: spring.soft,
      className: "glass-strong rounded-3xl p-10 max-w-md w-full text-center",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "cyan", children: "Run complete" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 font-display text-6xl text-white tracking-tight text-glow-violet", children: [
          s.score,
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[color:var(--muted)] text-xl font-mono ml-1", children: "pts" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-white/55 text-sm", children: [
          s.correct,
          " right · ",
          s.wrong,
          " wrong · ",
          accuracy,
          "% accuracy"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 grid grid-cols-3 gap-3 font-mono text-[11px] uppercase tracking-wider text-white/55", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Best ×", value: `×${s.bestCombo}` }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Stat,
            {
              label: "QPM",
              value: String(
                Math.round((s.correct + s.wrong) / Math.max(1, (s.endedAt ?? 0) - s.startedAt) * 6e4)
              )
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Stat,
            {
              label: "Time",
              value: `${Math.round(((s.endedAt ?? 0) - s.startedAt) / 100) / 10}s`
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 flex gap-3 justify-center", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: () => s.start(s.config.mode), children: "Run again" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "secondary", onClick: () => s.reset(), children: "Change mode" })
        ] })
      ]
    }
  ) }) });
}
function Stat({ label, value }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-xl py-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-base text-white normal-case tracking-tight", children: value }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[10px]", children: label })
  ] });
}

export { SpeedPage as default };
