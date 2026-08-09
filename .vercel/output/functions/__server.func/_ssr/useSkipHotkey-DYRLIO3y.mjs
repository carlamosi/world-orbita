import { i as isBrowser, d as db } from './orbita-db-Bdp3ClIj.mjs';
import { d as dateKey, e as evaluateUnlocks } from './unlocks-Bp4r3G0f.mjs';
import { newOpId, getClientId } from './clientId-B0Bcj0A6.mjs';
import { r as reactExports } from '../_libs/react.mjs';

function buildEnqueueRow(args) {
  const payload = { ...args.payload, client_id: getClientId() };
  return {
    op_id: args.op_id ?? newOpId(),
    entity: args.entity,
    op: args.op,
    payload,
    created_at: Date.now(),
    attempts: 0,
    next_attempt_at: Date.now(),
    status: "pending"
  };
}
function enqueue(args) {
  if (typeof window === "undefined") return;
  try {
    const row = buildEnqueueRow(args);
    void db().outbox.put(row).catch(() => {
    });
  } catch {
  }
}

async function getAllProgress() {
  if (!isBrowser()) return [];
  try {
    return await db().countryProgress.toArray();
  } catch {
    return [];
  }
}
async function updateSkillProgress(iso3, skill, mutator) {
  if (!isBrowser()) return;
  try {
    let nextRow = null;
    await db().transaction("rw", db().countryProgress, async () => {
      const prev = await db().countryProgress.get(iso3);
      const skills = { ...prev?.skills ?? {} };
      skills[skill] = mutator(skills[skill]);
      const skill_versions = { ...prev?.skill_versions ?? {} };
      skill_versions[skill] = (skill_versions[skill] ?? 0) + 1;
      const next = {
        iso3,
        skills,
        skill_versions,
        lastSeenAt: Math.max(prev?.lastSeenAt ?? 0, skills[skill].lastSeenAt),
        updated_at: Date.now(),
        dirty: 1
      };
      await db().countryProgress.put(next);
      nextRow = next;
    });
    if (nextRow) {
      const row = nextRow;
      enqueue({
        entity: "country_progress",
        op: "upsert",
        payload: {
          country_code: row.iso3,
          skills: row.skills,
          skill_versions: row.skill_versions ?? {},
          last_seen_at: new Date(row.lastSeenAt).toISOString()
        }
      });
    }
  } catch (e) {
    console.warn("[orbita-db] updateSkillProgress failed", e);
  }
}
async function getAllSessions() {
  if (!isBrowser()) return [];
  try {
    return await db().gameSessions.toArray();
  } catch {
    return [];
  }
}
async function recordSessionEnd(row) {
  if (!isBrowser()) return;
  try {
    const op_id = newOpId();
    const withId = {
      ...row,
      op_id,
      updated_at: Date.now(),
      dirty: 1
    };
    await db().gameSessions.add(withId);
    enqueue({
      op_id,
      entity: "sessions_log",
      op: "insert",
      payload: {
        mode: row.mode,
        skill: row.skill,
        score: row.score,
        total_questions: row.totalQuestions,
        correct: row.correct,
        wrong: row.wrong,
        best_combo: row.bestCombo,
        duration_ms: row.durationMs,
        period_key: row.periodKey,
        meta: row.meta,
        started_at: new Date(row.createdAt - row.durationMs).toISOString(),
        ended_at: new Date(row.createdAt).toISOString()
      }
    });
    const deltas = await reEvaluateUnlocks();
    for (const u of deltas) {
      enqueue({
        entity: "unlocks",
        op: "upsert",
        payload: {
          key: u.key,
          progress: u.progress,
          unlocked_at: u.unlockedAt ? new Date(u.unlockedAt).toISOString() : null
        }
      });
    }
    const k = dateKey(row.createdAt);
    enqueue({
      entity: "daily_streak",
      op: "upsert",
      payload: {
        date_key: k,
        count: 1,
        last_active_at: new Date(row.createdAt).toISOString()
      }
    });
  } catch (e) {
    console.warn("[orbita-db] recordSessionEnd failed", e);
  }
}
async function getUnlocks() {
  if (!isBrowser()) return [];
  try {
    return await db().unlocks.toArray();
  } catch {
    return [];
  }
}
async function reEvaluateUnlocks() {
  if (!isBrowser()) return [];
  const [progress, sessions, current] = await Promise.all([
    getAllProgress(),
    getAllSessions(),
    getUnlocks()
  ]);
  const input = {
    progress,
    sessions,
    now: Date.now(),
    existing: new Map(current.map((u) => [u.key, u]))
  };
  const deltas = evaluateUnlocks(input);
  if (deltas.length === 0) return current;
  try {
    await db().unlocks.bulkPut(deltas);
  } catch (e) {
    console.warn("[orbita-db] bulk unlocks put failed", e);
  }
  return [...current.filter((c) => !deltas.find((d) => d.key === c.key)), ...deltas];
}
async function getPref(key) {
  if (!isBrowser()) return null;
  try {
    const m = await db().meta.get("meta");
    return m?.prefs?.[key] ?? null;
  } catch {
    return null;
  }
}
async function setPref(key, value) {
  if (!isBrowser()) return;
  try {
    const m = await db().meta.get("meta");
    const prefs = { ...m?.prefs ?? {}, [key]: value };
    await db().meta.put({
      id: "meta",
      schemaVersion: m?.schemaVersion ?? 2,
      lastOpenedAt: Date.now(),
      prefs
    });
  } catch (e) {
    console.warn("[orbita-db] setPref failed", e);
  }
}

function useSkipHotkey(onSkip, enabled = true) {
  reactExports.useEffect(() => {
    if (!enabled) return;
    function onKey(e) {
      if (e.key !== " " && e.code !== "Space") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable)
          return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      e.preventDefault();
      onSkip();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onSkip, enabled]);
}

export { updateSkillProgress as a, getPref as g, recordSessionEnd as r, setPref as s, useSkipHotkey as u };
