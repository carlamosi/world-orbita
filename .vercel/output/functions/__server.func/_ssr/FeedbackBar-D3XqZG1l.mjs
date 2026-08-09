import { s as spring, B as Badge, C as COUNTRIES } from './motion-B8-Vl7RP.mjs';
import { u as updateFsrs, r as retrievability } from './unlocks-Bp4r3G0f.mjs';
import { a as assess, r as recordConceptAttempt } from './ContinentSelect-nxtEY6fc.mjs';
import { d as db } from './orbita-db-Bdp3ClIj.mjs';
import { r as recordSessionEnd } from './useSkipHotkey-DYRLIO3y.mjs';
import { j as jsxRuntimeExports } from '../_libs/react.mjs';
import { L as Link } from '../_libs/tanstack__react-router.mjs';
import { B as Button } from './orbita-button-CKjnWSTu.mjs';
import { m as motion, A as AnimatePresence } from '../_libs/framer-motion.mjs';
import { c as create } from '../_libs/zustand.mjs';

function generateSessionQueue(allConcepts, explorationIso3, config = {}) {
  const now = Date.now();
  const sessionSize = config.sessionSize || 20;
  const maxNew = config.maxNewPerSession || 5;
  const bucketA = [];
  const bucketB = [];
  const bucketC = [];
  const bucketD = [];
  const bucketE = [];
  for (const concept of allConcepts) {
    if (concept.fsrs_state === "learning" || concept.fsrs_state === "relearning") {
      if (concept.fsrs_due <= now) {
        bucketA.push(concept);
      }
    } else if (concept.fsrs_state === "review") {
      if (concept.fsrs_due <= now) {
        bucketB.push(concept);
      } else {
        const elapsedDays = Math.max(0, (now - concept.fsrs_last_review) / 864e5);
        const R = retrievability(concept.fsrs_stability, elapsedDays);
        if (R < 0.5) {
          bucketC.push(concept);
        }
      }
    } else if (concept.fsrs_state === "new") {
      {
        bucketE.push(concept);
      }
    }
  }
  bucketA.sort((a, b) => a.fsrs_due - b.fsrs_due);
  bucketB.sort((a, b) => a.fsrs_due - b.fsrs_due);
  let rawQueue = [];
  rawQueue.push(...bucketA);
  rawQueue.push(...bucketB);
  rawQueue.push(...bucketC);
  rawQueue.push(...bucketD);
  rawQueue.push(...bucketE.slice(0, Math.max(0, maxNew - bucketD.length)));
  if (rawQueue.length > sessionSize) {
    rawQueue = rawQueue.slice(0, sessionSize);
  }
  return applyAntiRepetitionConstraints(rawQueue);
}
function applyAntiRepetitionConstraints(queue) {
  if (queue.length <= 1) return queue;
  const result = [];
  const remaining = [...queue];
  while (remaining.length > 0) {
    let bestIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (isValidNext(result, candidate)) {
        bestIdx = i;
        break;
      }
    }
    result.push(remaining.splice(bestIdx, 1)[0]);
  }
  return result;
}
function isValidNext(currentQueue, nextItem) {
  if (currentQueue.length === 0) return true;
  const last = currentQueue[currentQueue.length - 1];
  if (last.iso3 === nextItem.iso3) return false;
  if (currentQueue.length >= 2) {
    const secondLast = currentQueue[currentQueue.length - 2];
    if (last.skill === nextItem.skill && secondLast.skill === nextItem.skill) {
      return false;
    }
  }
  return true;
}

const QUESTIONS_PER_SESSION = 20;
function createSessionStore({
  mode,
  skill,
  questions = QUESTIONS_PER_SESSION
}) {
  return create((set, get) => ({
    queue: [],
    conceptQueue: [],
    index: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    answerState: "idle",
    startedAt: 0,
    endedAt: null,
    loading: false,
    questionStartedAt: 0,
    current() {
      const s = get();
      return s.queue[s.index] ?? null;
    },
    async start(opts) {
      set({
        loading: true,
        queue: [],
        conceptQueue: [],
        index: 0,
        score: 0,
        combo: 0,
        bestCombo: 0,
        correct: 0,
        wrong: 0,
        answerState: "idle",
        startedAt: 0,
        endedAt: null,
        questionStartedAt: 0
      });
      let q = [];
      let cq = [];
      if (opts?.allCountries && opts.allCountries.length > 0) {
        q = [...opts.allCountries];
        for (let i = q.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q[i], q[j]] = [q[j], q[i]];
        }
        cq = Array(q.length).fill(null);
      } else {
        const allConcepts = await db().concept_progress.where("skill").equals(skill).toArray();
        let pool = allConcepts;
        if (opts?.continent && opts.continent !== "All") {
          const validIso3s = new Set(COUNTRIES.filter((c) => c.continent === opts.continent).map((c) => c.iso3));
          pool = allConcepts.filter((c) => validIso3s.has(c.iso3));
        }
        if (pool.length < questions) {
          const used = new Set(pool.map((c) => c.iso3));
          const candidates = COUNTRIES.filter((c) => !opts?.continent || opts.continent === "All" || c.continent === opts.continent);
          for (const c of candidates) {
            if (pool.length >= questions) break;
            if (!used.has(c.iso3)) {
              pool.push({
                conceptId: `${c.iso3}:${skill}`,
                iso3: c.iso3,
                skill,
                fsrs_state: "new",
                fsrs_stability: null,
                fsrs_difficulty: null,
                fsrs_due: 0,
                fsrs_reps: 0,
                fsrs_lapses: 0,
                fsrs_last_review: 0,
                updated_at: Date.now(),
                version: 1,
                dirty: 0
              });
              used.add(c.iso3);
            }
          }
        }
        const plannedConcepts = generateSessionQueue(pool, void 0, { sessionSize: questions });
        const isoToCountry = new Map(COUNTRIES.map((c) => [c.iso3, c]));
        q = plannedConcepts.map((c) => isoToCountry.get(c.iso3)).filter(Boolean);
        cq = plannedConcepts;
      }
      const now = Date.now();
      set({
        queue: q,
        conceptQueue: cq,
        index: 0,
        score: 0,
        combo: 0,
        bestCombo: 0,
        correct: 0,
        wrong: 0,
        answerState: "idle",
        startedAt: now,
        endedAt: null,
        loading: false,
        questionStartedAt: now
      });
    },
    submit(isCorrect) {
      const s = get();
      if (s.answerState !== "idle") return;
      const target = s.queue[s.index];
      const targetConcept = s.conceptQueue[s.index];
      if (!target) return;
      const responseMs = Math.max(0, Date.now() - (s.questionStartedAt || Date.now()));
      if (isCorrect) {
        const combo = s.combo + 1;
        const base = 100;
        const comboBonus = Math.min(combo - 1, 9) * 20;
        const gained = base + comboBonus;
        set({
          score: s.score + gained,
          combo,
          bestCombo: Math.max(s.bestCombo, combo),
          correct: s.correct + 1,
          answerState: "correct"
        });
      } else {
        set({ combo: 0, wrong: s.wrong + 1, answerState: "wrong" });
      }
      if (targetConcept) {
        const now = Date.now();
        const overdueMs = Math.max(0, now - targetConcept.fsrs_due);
        const grade = assess({
          validationResult: { correct: isCorrect, softCorrect: false },
          // we can refine softCorrect later for maps
          responseMs,
          attemptNumber: 1,
          // multiple attempts logic can be expanded later
          hintsUsed: 0,
          questionType: skill,
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
          // transient
          lastGrade: null
        };
        const nextFsrs = updateFsrs(currentFsrs, grade, now);
        const updatedProgressRow = {
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
        };
        recordConceptAttempt(
          updatedProgressRow,
          {
            op_id: crypto.randomUUID(),
            conceptId: targetConcept.conceptId,
            sessionId: "session-" + s.startedAt,
            grade,
            responseMs,
            correct: isCorrect,
            answeredAt: now
          }
        ).catch(console.error);
        s.conceptQueue[s.index] = updatedProgressRow;
      }
    },
    reveal() {
      set({ answerState: "revealed" });
    },
    next() {
      const s = get();
      const nextIndex = s.index + 1;
      if (nextIndex >= s.queue.length) {
        const endedAt = Date.now();
        set({ endedAt, answerState: "idle", combo: 0 });
        recordSessionEnd({
          mode,
          skill,
          score: s.score,
          totalQuestions: s.queue.length,
          correct: s.correct,
          wrong: s.wrong,
          bestCombo: s.bestCombo,
          durationMs: endedAt - s.startedAt,
          createdAt: endedAt
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("orbita:session-end", { detail: { score: s.score, correct: s.correct } }));
        }
        return;
      }
      set({
        index: nextIndex,
        answerState: "idle",
        questionStartedAt: Date.now()
      });
    }
  }));
}

function SessionEnd({
  show,
  score,
  correct,
  total,
  wrong,
  bestCombo,
  durationMs,
  onReplay
}) {
  const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
  const seconds = Math.round(durationMs / 100) / 10;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: show && /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      className: "fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md bg-black/50",
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        motion.div,
        {
          initial: { y: 30, scale: 0.96, opacity: 0 },
          animate: { y: 0, scale: 1, opacity: 1 },
          transition: spring.soft,
          className: "glass-strong rounded-3xl p-10 max-w-md w-full text-center",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "cyan", children: "Session complete" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 font-display text-5xl text-white tracking-tight text-glow-violet", children: [
              score,
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[color:var(--muted)] text-xl font-mono ml-1", children: "pts" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-white/55 text-sm", children: [
              correct,
              "/",
              total,
              " correct · ",
              seconds,
              "s"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 grid grid-cols-3 gap-3 font-mono text-[11px] uppercase tracking-wider text-white/55", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Accuracy", value: `${accuracy}%` }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Best combo", value: `×${bestCombo}` }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Wrong", value: wrong })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 flex gap-3 justify-center", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: onReplay, children: "Play again" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "secondary", children: "Home" }) })
            ] })
          ]
        }
      )
    }
  ) });
}
function Stat({ label, value }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-xl py-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-base text-white normal-case tracking-tight", children: value }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[10px]", children: label })
  ] });
}

function PromptPill({ keyId, index, total, title }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      initial: { opacity: 0, y: -8 },
      animate: { opacity: 1, y: 0 },
      transition: spring.soft,
      className: "pointer-events-none px-4",
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-full pl-4 pr-5 py-2 flex items-center gap-3 pointer-events-auto max-w-[min(92vw,640px)] mx-auto", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45 whitespace-nowrap tabular-nums", children: [
          index + 1,
          " / ",
          total
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-3 w-px bg-white/15 shrink-0" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-sm md:text-base text-white tracking-tight truncate", children: title })
      ] })
    },
    keyId
  );
}

function FeedbackBar({
  show,
  state,
  title,
  subtitle,
  onNext,
  onSkip,
  hideNext
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: show && /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: 30 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
      transition: spring.crisp,
      className: "px-4 w-full max-w-md mx-auto",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: `glass-strong rounded-2xl px-6 py-5 flex items-center justify-between gap-4 ${state === "correct" ? "shadow-[0_0_60px_-10px_color-mix(in_oklab,var(--neon)_60%,transparent)]" : "shadow-[0_0_60px_-10px_color-mix(in_oklab,var(--coral)_50%,transparent)]"}`,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-left min-w-0 flex-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45", children: state === "correct" ? "Nailed it" : state === "wrong" ? "Not quite" : "Revealed" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-lg text-white truncate", children: title }),
                subtitle && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[12px] text-white/55 truncate", children: subtitle })
              ] }),
              !hideNext && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", onClick: onNext, children: "Next →" })
            ]
          }
        ),
        state === "wrong" && onSkip && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: onSkip,
            className: "mx-auto block mt-2 text-[11px] font-mono uppercase tracking-wider text-white/40 hover:text-white/70",
            children: "Skip"
          }
        )
      ]
    },
    state
  ) });
}

export { FeedbackBar as F, PromptPill as P, SessionEnd as S, createSessionStore as c };
