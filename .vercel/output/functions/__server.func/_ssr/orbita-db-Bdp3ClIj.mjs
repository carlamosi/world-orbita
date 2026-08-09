import { D as Dexie } from '../_libs/dexie.mjs';
import '../_libs/react.mjs';

const state = {
  current: null,
  name: "orbita-local",
  listeners: /* @__PURE__ */ new Set()
};
function getCurrent() {
  return state.current;
}
function setCurrent(db, name) {
  state.current = db;
  state.name = name;
}
function getDbSync() {
  if (!state.current) throw new Error("Orbita DB not initialised");
  return state.current;
}
async function ensureDb() {
  if (state.current) return state.current;
  state.current = createOrbitaDb(state.name);
  return state.current;
}
async function swap(userId) {
  const next = `orbita-${userId ?? "local"}`;
  if (state.current && state.name === next) return state.current;
  const prev = state.current;
  const prevName = state.name;
  const nextDb = createOrbitaDb(next);
  if (userId && prev && prevName === "orbita-local") {
    try {
      await mergeLocalIntoUserDb(prev, nextDb);
    } catch (e) {
      console.warn("[dbProvider] merge skipped:", e);
    }
  }
  if (prev) {
    try {
      prev.close();
    } catch {
    }
  }
  state.name = next;
  state.current = nextDb;
  for (const l of state.listeners) {
    try {
      l(state.current);
    } catch {
    }
  }
  return state.current;
}
async function mergeLocalIntoUserDb(local, target) {
  const [progress, unlocks, sessions] = await Promise.all([
    local.countryProgress.toArray().catch(() => []),
    local.unlocks.toArray().catch(() => []),
    local.gameSessions.toArray().catch(() => [])
  ]);
  const targetCount = await target.countryProgress.count().catch(() => 0);
  if (targetCount > 0) return;
  const { getClientId, newOpId } = await import('./clientId-B0Bcj0A6.mjs');
  const cid = getClientId();
  const now = Date.now();
  if (progress.length) await target.countryProgress.bulkPut(progress).catch(() => {
  });
  if (unlocks.length) await target.unlocks.bulkPut(unlocks).catch(() => {
  });
  if (sessions.length) await target.gameSessions.bulkPut(sessions).catch(() => {
  });
  const rows = [
    ...progress.map((r) => ({
      op_id: newOpId(),
      entity: "country_progress",
      op: "upsert",
      payload: {
        country_code: r.iso3,
        skills: r.skills,
        skill_versions: r.skill_versions ?? {},
        last_seen_at: new Date(r.lastSeenAt || now).toISOString(),
        client_id: cid
      },
      created_at: now,
      attempts: 0,
      next_attempt_at: now,
      status: "pending"
    })),
    ...unlocks.map((u) => ({
      op_id: newOpId(),
      entity: "unlocks",
      op: "upsert",
      payload: {
        key: u.key,
        progress: u.progress,
        unlocked_at: u.unlockedAt ? new Date(u.unlockedAt).toISOString() : null,
        client_id: cid
      },
      created_at: now,
      attempts: 0,
      next_attempt_at: now,
      status: "pending"
    }))
  ];
  if (rows.length) await target.outbox.bulkPut(rows).catch(() => {
  });
}
function onSwap(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
function currentDbName() {
  return state.name;
}

const dbProvider = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  currentDbName,
  ensureDb,
  getCurrent,
  getDbSync,
  onSwap,
  setCurrent,
  swap
}, Symbol.toStringTag, { value: 'Module' }));

const ALL_SKILLS = ["location", "name", "flag", "capital"];
class OrbitaDB extends Dexie {
  countryProgress;
  gameSessions;
  challengeAttempts;
  unlocks;
  meta;
  outbox;
  sync_meta;
  concept_progress;
  question_history;
  daily_summary;
  constructor(name) {
    super(name);
    this.version(1).stores({
      countryProgress: "key, iso3, skill, lastSeenAt, confidence",
      gameSessions: "++id, mode, skill, createdAt",
      meta: "id"
    });
    this.version(2).stores({
      countryProgress: "iso3, lastSeenAt",
      gameSessions: "++id, mode, skill, createdAt, periodKey",
      unlocks: "key, unlockedAt",
      meta: "id"
    }).upgrade(async (tx) => {
      const old = await tx.table(
        "countryProgress"
      ).toArray().catch(() => []);
      const grouped = /* @__PURE__ */ new Map();
      for (const row of old) {
        const existing = grouped.get(row.iso3) ?? {
          iso3: row.iso3,
          skills: {},
          lastSeenAt: 0
        };
        existing.skills[row.skill] = {
          confidence: row.confidence,
          timesRight: row.timesRight,
          timesWrong: row.timesWrong,
          streak: row.streak,
          lastSeenAt: row.lastSeenAt
        };
        existing.lastSeenAt = Math.max(existing.lastSeenAt, row.lastSeenAt);
        grouped.set(row.iso3, existing);
      }
      await tx.table("countryProgress").clear();
      if (grouped.size > 0) {
        await tx.table("countryProgress").bulkPut([...grouped.values()]);
      }
    });
    this.version(3).stores({
      countryProgress: "iso3, lastSeenAt, updated_at",
      gameSessions: "++id, &op_id, mode, skill, createdAt, periodKey, updated_at",
      challengeAttempts: "++id, &op_id, [kind+periodKey+questionIndex], createdAt",
      unlocks: "key, unlockedAt, updatedAt",
      meta: "id",
      outbox: "++id, &op_id, entity, status, next_attempt_at, created_at",
      sync_meta: "&key"
    });
    this.version(4).stores({
      concept_progress: "conceptId, fsrs_due, dirty, updated_at",
      question_history: "op_id, conceptId, answeredAt",
      daily_summary: "dateKey, dirty"
    });
    this.version(5).stores({
      concept_progress: "conceptId, [user_id+skill], fsrs_due, dirty, updated_at"
    });
  }
}
function createOrbitaDb(name) {
  const d = new OrbitaDB(name);
  d.meta.put({ id: "meta", schemaVersion: 3, lastOpenedAt: Date.now(), prefs: {} }).catch(() => {
  });
  return d;
}
function db() {
  if (typeof window === "undefined") {
    throw new Error("Orbita DB is browser-only");
  }
  const cur = getCurrent();
  if (cur) return cur;
  const fresh = createOrbitaDb("orbita-local");
  setCurrent(fresh, "orbita-local");
  return fresh;
}
function isBrowser() {
  return typeof window !== "undefined";
}

export { ALL_SKILLS as A, currentDbName as a, dbProvider as b, createOrbitaDb as c, db as d, isBrowser as i };
