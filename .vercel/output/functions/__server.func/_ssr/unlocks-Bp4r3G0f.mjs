import { C as COUNTRIES } from './motion-B8-Vl7RP.mjs';

const W = [
  0.4072,
  1.1829,
  3.1262,
  15.4722,
  7.2102,
  0.5316,
  1.0651,
  0.0589,
  1.533,
  0.1544,
  1.0059,
  1.9395,
  0.11,
  0.29,
  2.27,
  0.24,
  2.9898,
  0.51,
  0.43
];
const FACTOR = 19 / 81;
const DAY_MS = 864e5;
const MINUTE_MS = 6e4;
const LEARNING_STEPS_MS = [1 * MINUTE_MS, 10 * MINUTE_MS];
const RELEARNING_STEPS_MS = [10 * MINUTE_MS];
function retrievability(stability, elapsedDays) {
  if (stability === null || stability === 0) return 0;
  return Math.pow(1 + FACTOR * elapsedDays / stability, -1);
}
function constrainDifficulty(d) {
  return Math.min(10, Math.max(1, d));
}
function createNewState(now = Date.now()) {
  return {
    state: "new",
    stability: null,
    difficulty: null,
    due: now,
    lastReviewAt: 0,
    reps: 0,
    lapses: 0,
    learningStep: 0,
    lastGrade: null
  };
}
function updateFsrs(current, grade, now = Date.now()) {
  const state = current ?? createNewState(now);
  const next = { ...state, reps: state.reps + 1, lastReviewAt: now, lastGrade: grade };
  if (state.state === "new") {
    next.state = "learning";
    next.difficulty = constrainDifficulty(W[4] - Math.exp(W[5] * (grade - 1)) + 1);
    next.stability = W[grade];
    if (grade >= 2) {
      next.state = "review";
      next.due = now + next.stability * DAY_MS;
    } else {
      next.learningStep = 0;
      next.due = now + LEARNING_STEPS_MS[next.learningStep];
    }
    return next;
  }
  if (state.state === "learning" || state.state === "relearning") {
    if (grade === 0) {
      next.learningStep = 0;
      next.due = now + (state.state === "learning" ? LEARNING_STEPS_MS[0] : RELEARNING_STEPS_MS[0]);
    } else if (grade >= 2) {
      next.state = "review";
      next.due = now + next.stability * DAY_MS;
    } else {
      const steps = state.state === "learning" ? LEARNING_STEPS_MS : RELEARNING_STEPS_MS;
      next.learningStep = Math.min(next.learningStep + 1, steps.length - 1);
      next.due = now + steps[next.learningStep];
    }
    return next;
  }
  if (state.state === "review") {
    const elapsedDays = Math.max(0, (now - state.lastReviewAt) / DAY_MS);
    const R = retrievability(state.stability, elapsedDays);
    const S_old = state.stability;
    const D_old = state.difficulty;
    next.difficulty = constrainDifficulty(D_old - W[6] * (grade - 3));
    if (grade === 0) {
      next.state = "relearning";
      next.lapses++;
      next.learningStep = 0;
      next.due = now + RELEARNING_STEPS_MS[0];
      next.stability = W[11] * Math.pow(D_old, -0.11) * (Math.pow(S_old + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
    } else {
      const gradeMod = grade === 1 ? W[15] : grade === 2 ? 1 : W[16];
      next.stability = S_old * (Math.exp(W[8]) * (11 - next.difficulty) * Math.pow(S_old, -0.1544) * (Math.exp(W[10] * (1 - R)) - 1) * gradeMod + 1);
      next.due = now + next.stability * DAY_MS;
    }
    return next;
  }
  return next;
}

function dateKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function weekKey(ts = Date.now()) {
  const d = new Date(ts);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 864e5;
  const week = 1 + Math.round((diff - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function prevDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1);
  return dateKey(date.getTime());
}
function currentStreak(activeDays, today = dateKey()) {
  let cursor = today;
  if (!activeDays.has(cursor)) cursor = prevDateKey(cursor);
  let count = 0;
  while (activeDays.has(cursor)) {
    count++;
    cursor = prevDateKey(cursor);
  }
  return count;
}
function longestStreak(activeDays) {
  if (activeDays.size === 0) return 0;
  const sorted = [...activeDays].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (prevDateKey(sorted[i]) === sorted[i - 1]) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

const DEFINITIONS = [
  { key: "first_100", title: "Centurion", description: "Answer 100 total questions.", category: "milestone" },
  { key: "first_500", title: "500 club", description: "Answer 500 total questions.", category: "milestone" },
  { key: "perfectionist", title: "Perfectionist", description: "Finish a session with 100% accuracy (≥10 questions).", category: "skill" },
  { key: "streak_3", title: "On a roll", description: "Practice 3 days in a row.", category: "streak" },
  { key: "streak_7", title: "Orbital habit", description: "Practice 7 days in a row.", category: "streak" },
  { key: "speed_demon", title: "Speed demon", description: "Score 30+ in a 60s Speed Round.", category: "speed" },
  { key: "africa_mastered", title: "Africa mastered", description: "Reach 80% confidence on every African country (any skill).", category: "region" },
  { key: "europe_mastered", title: "Europe mastered", description: "Reach 80% confidence on every European country (any skill).", category: "region" },
  { key: "asia_mastered", title: "Asia mastered", description: "Reach 80% confidence on every Asian country (any skill).", category: "region" },
  { key: "americas_mastered", title: "Americas mastered", description: "Reach 80% confidence on every American country (any skill).", category: "region" },
  { key: "oceania_mastered", title: "Oceania mastered", description: "Reach 80% confidence on every Oceanian country (any skill).", category: "region" }
];
function evaluateUnlocks(input) {
  const totals = input.sessions.reduce(
    (acc, s) => {
      acc.q += s.totalQuestions;
      return acc;
    },
    { q: 0 }
  );
  const perfectSessions = input.sessions.filter(
    (s) => s.totalQuestions >= 10 && s.correct === s.totalQuestions
  );
  const speedBest = input.sessions.filter((s) => s.mode === "speed").reduce((m, s) => Math.max(m, s.score), 0);
  const activeDays = new Set(input.sessions.map((s) => dateKey(s.createdAt)));
  const streak = currentStreak(activeDays);
  const byIso = new Map(input.progress.map((p) => [p.iso3, p]));
  function regionMastered(continent) {
    const list = COUNTRIES.filter((c) => c.continent === continent);
    if (list.length === 0) return 0;
    const mastered = list.filter((c) => {
      const p = byIso.get(c.iso3);
      if (!p) return false;
      return Object.values(p.skills).some((s) => s && s.confidence >= 0.8);
    }).length;
    return mastered / list.length;
  }
  const candidates = [
    { key: "first_100", progress: Math.min(1, totals.q / 100), unlocked: totals.q >= 100 },
    { key: "first_500", progress: Math.min(1, totals.q / 500), unlocked: totals.q >= 500 },
    { key: "perfectionist", progress: perfectSessions.length > 0 ? 1 : 0, unlocked: perfectSessions.length > 0 },
    { key: "streak_3", progress: Math.min(1, streak / 3), unlocked: streak >= 3 },
    { key: "streak_7", progress: Math.min(1, streak / 7), unlocked: streak >= 7 },
    { key: "speed_demon", progress: Math.min(1, speedBest / 30), unlocked: speedBest >= 30 },
    { key: "africa_mastered", progress: regionMastered("Africa"), unlocked: regionMastered("Africa") >= 1 },
    { key: "europe_mastered", progress: regionMastered("Europe"), unlocked: regionMastered("Europe") >= 1 },
    { key: "asia_mastered", progress: regionMastered("Asia"), unlocked: regionMastered("Asia") >= 1 },
    { key: "americas_mastered", progress: regionMastered("Americas"), unlocked: regionMastered("Americas") >= 1 },
    { key: "oceania_mastered", progress: regionMastered("Oceania"), unlocked: regionMastered("Oceania") >= 1 }
  ];
  const deltas = [];
  for (const c of candidates) {
    const prev = input.existing.get(c.key);
    const prevUnlocked = prev?.unlockedAt != null;
    const nextProgress = Number(c.progress.toFixed(3));
    const unlockedAt = prevUnlocked ? prev.unlockedAt : c.unlocked ? input.now : null;
    const changed = !prev || prev.progress !== nextProgress || prev.unlockedAt !== unlockedAt;
    if (changed) {
      deltas.push({
        key: c.key,
        progress: nextProgress,
        unlockedAt,
        updatedAt: input.now
      });
    }
  }
  return deltas;
}

export { DEFINITIONS as D, currentStreak as c, dateKey as d, evaluateUnlocks as e, longestStreak as l, retrievability as r, updateFsrs as u, weekKey as w };
