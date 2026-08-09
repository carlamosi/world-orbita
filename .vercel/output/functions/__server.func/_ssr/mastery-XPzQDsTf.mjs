import { C as COUNTRIES } from './motion-B8-Vl7RP.mjs';
import { d as db } from './orbita-db-Bdp3ClIj.mjs';
import { r as retrievability } from './unlocks-Bp4r3G0f.mjs';

const DAY_MS$1 = 864e5;
const FAST_MS = 4e3;
const NORMAL_MS = 12e3;
function initSrs(now = Date.now()) {
  return {
    ef: 2.5,
    reps: 0,
    interval: 0,
    nextReviewAt: now,
    lastReviewedAt: 0
  };
}
function quality({ correct, responseMs }) {
  if (!correct) return 1;
  if (responseMs <= FAST_MS) return 5;
  if (responseMs <= NORMAL_MS) return 4;
  return 3;
}
function updateSrs(prev, input, now = Date.now()) {
  const base = prev ?? initSrs(now);
  const q = quality(input);
  let ef = base.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;
  if (ef > 2.8) ef = 2.8;
  let reps;
  let interval;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps = base.reps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(base.interval * ef);
    if (interval < 1) interval = 1;
  }
  return {
    ef: Number(ef.toFixed(4)),
    reps,
    interval,
    lastReviewedAt: now,
    nextReviewAt: now + interval * DAY_MS$1
  };
}
function retention(srs, now = Date.now()) {
  if (!srs || srs.reps === 0) return 0;
  const elapsedDays = Math.max(0, (now - srs.lastReviewedAt) / DAY_MS$1);
  const r = Math.exp(-elapsedDays / Math.max(0.5, srs.interval));
  return Math.max(0, Math.min(1, r));
}

const DAY_MS = 864e5;
function decay(prev, lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) return prev;
  const days = Math.max(0, (now - lastSeenAt) / DAY_MS);
  const factor = Math.pow(0.5, days / 14);
  return prev * factor;
}
function confidenceAfter(prev, correct, now = Date.now(), responseMs = 8e3) {
  const srs = updateSrs(prev?.srs, { correct, responseMs }, now);
  const confidence = correct ? Math.min(1, Math.max(0.2, retention(srs, now) * 0.4 + 0.6)) : Math.max(0, (prev?.confidence ?? 0) * 0.5 - 0.05);
  return {
    confidence: Number(confidence.toFixed(4)),
    timesRight: (prev?.timesRight ?? 0) + (correct ? 1 : 0),
    timesWrong: (prev?.timesWrong ?? 0) + (correct ? 0 : 1),
    streak: correct ? (prev?.streak ?? 0) + 1 : 0,
    lastSeenAt: now,
    srs
  };
}
function selectAllForContinent(continent) {
  const pool = !continent || continent === "All" ? [...COUNTRIES] : COUNTRIES.filter((c) => c.continent === continent);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
async function selectMixedQuestions(n, skills, opts = {}) {
  const concepts = await db().concept_progress.where("skill").anyOf(skills).toArray();
  const now = Date.now();
  const merged = /* @__PURE__ */ new Map();
  for (const c of concepts) {
    let r = 0.05;
    if (c.fsrs_state !== "new" && c.fsrs_stability) {
      r = retrievability(c.fsrs_stability, Math.max(0, (now - c.fsrs_last_review) / 864e5));
    }
    const cur = merged.get(c.iso3);
    if (!cur || r < cur.r) {
      merged.set(c.iso3, { r, lastSeenAt: c.fsrs_last_review || 0 });
    }
  }
  const exclude = opts.excludeIso3 ?? /* @__PURE__ */ new Set();
  const continent = opts.continent && opts.continent !== "All" ? opts.continent : null;
  const rng = opts.rng ?? Math.random;
  const pool = COUNTRIES.filter((c) => {
    if (exclude.has(c.iso3)) return false;
    if (continent && c.continent !== continent) return false;
    if (opts.difficulty && c.difficulty !== opts.difficulty) return false;
    return true;
  });
  const weighted = pool.map((c) => {
    const p = merged.get(c.iso3);
    const r = p ? decay(p.r, p.lastSeenAt, now) : 0.05;
    const daysUnseen = p ? (now - p.lastSeenAt) / DAY_MS : 365;
    const weight = (1 - r) * 2 + Math.min(daysUnseen / 14, 1) * 0.6 + 0.1;
    return { c, weight };
  });
  const picked = [];
  const used = /* @__PURE__ */ new Set();
  while (picked.length < n && picked.length < weighted.length) {
    const candidates = weighted.filter((w) => !used.has(w.c.iso3));
    if (candidates.length === 0) break;
    const total = candidates.reduce((s, w) => s + w.weight, 0);
    let r = rng() * total;
    let chosen = candidates[0];
    for (const w of candidates) {
      r -= w.weight;
      if (r <= 0) {
        chosen = w;
        break;
      }
    }
    picked.push(chosen.c);
    used.add(chosen.c.iso3);
  }
  return picked.map((c) => ({
    country: c,
    skill: skills[Math.floor(rng() * skills.length)]
  }));
}

export { selectMixedQuestions as a, confidenceAfter as c, selectAllForContinent as s };
