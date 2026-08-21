import Dexie, { type Table } from "dexie";
import { ensureDb, getDbSync } from "./dbProvider";
import { State } from "ts-fsrs";
import type { Grade } from "../fsrs/engine"; // ORBITA legacy grade 0-3 for UI display

/**
 * ORBITA local-first store (Dexie v3 with sync support).
 *
 * v3 additions over v2:
 * - countryProgress gains `skill_versions` (per-skill monotonic counters)
 * - gameSessions gains `op_id` (uuid for exactly-once cloud insert)
 * - new tables: `outbox` (sync queue) and `sync_meta` (cursors/client_id)
 * - new table: `challengeAttempts` (append-only per question)
 *
 * The DB is opened via dbProvider so it can be swapped per signed-in user
 * (DB name: `orbita-${userId ?? 'local'}`). Existing repo code that calls
 * `db()` keeps working because db() delegates to the provider.
 */

export type Skill = "location" | "name" | "flag" | "capital";
export const ALL_SKILLS: readonly Skill[] = ["location", "name", "flag", "capital"];

export interface SkillStat {
  confidence: number;
  timesRight: number;
  timesWrong: number;
  streak: number;
  lastSeenAt: number;
  /** SM-2 spaced-repetition state, populated by the SRS engine. */
  srs?: {
    ef: number;
    reps: number;
    interval: number;
    nextReviewAt: number;
    lastReviewedAt: number;
  };
}

export interface CountryProgressRow {
  iso3: string;
  skills: Partial<Record<Skill, SkillStat>>;
  /** monotonic counters per skill, bumped on every local mutation */
  skill_versions?: Partial<Record<Skill, number>>;
  lastSeenAt: number;
  updated_at?: number;
  dirty?: 0 | 1;
}

export interface ConceptProgressRow {
  conceptId: string; // PK: e.g., "FRA:location"
  iso3: string;
  skill: string;
  /** null = guest/local; set after sign-in for cloud sync scoping */
  user_id?: string | null;
  fsrs_state: number; // State enum from ts-fsrs (0=New, 1=Learning, 2=Review, 3=Relearning)
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_due: number;
  fsrs_reps: number;
  fsrs_lapses: number;
  fsrs_last_review: number;
  fsrs_elapsed_days?: number;
  fsrs_scheduled_days?: number;
  updated_at: number;
  version: number;
  dirty: 0 | 1;
}

export interface QuestionHistoryRow {
  op_id: string; // PK
  conceptId: string;
  sessionId: string;
  grade: Grade; // ORBITA legacy grade, can be kept for UI but we also track FSRS metadata
  mode: string; // Easy, Hard, etc.
  direction: string; // Country->Capital, etc.
  fsrs_log?: any; // Raw ts-fsrs ReviewLog serialized
  responseMs: number;
  correct: boolean;
  answeredAt: number;
}

export interface DailySummaryRow {
  dateKey: string; // PK: "YYYY-MM-DD"
  reviewsCount: number;
  correctCount: number;
  timeSpentMs: number;
  updated_at: number;
  dirty: 0 | 1;
}

export type GameMode =
  | "find"
  | "name"
  | "flag"
  | "capital"
  | "speed"
  | "challenge_daily"
  | "challenge_weekly";

export interface GameSessionRow {
  id?: number;
  op_id?: string;
  mode: GameMode;
  skill: Skill | "mixed";
  score: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  bestCombo: number;
  durationMs: number;
  createdAt: number;
  periodKey?: string;
  meta?: Record<string, number | string>;
  updated_at?: number;
  dirty?: 0 | 1;
}

export interface ChallengeAttemptRow {
  id?: number;
  op_id: string;
  kind: "daily" | "weekly";
  periodKey: string;
  questionIndex: number;
  correct: boolean;
  ms: number;
  createdAt: number;
}

export interface UnlockRow {
  key: string;
  progress: number;
  unlockedAt: number | null;
  updatedAt: number;
}

export interface MetaRow {
  id: "meta";
  schemaVersion: number;
  lastOpenedAt: number;
  prefs: Record<string, string>;
}

export interface OutboxRow {
  id?: number;
  op_id: string;
  entity:
    | "sessions_log"
    | "country_progress"
    | "challenge_attempts"
    | "unlocks"
    | "daily_streak"
    | "profiles"
    | "concept_progress"
    | "question_history"
    | "daily_summary";
  op: "insert" | "upsert";
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  next_attempt_at: number;
  status: "pending" | "in_flight" | "dead";
  last_error?: string;
}

export interface SyncMetaRow {
  key: string;
  value: string;
}

export class OrbitaDB extends Dexie {
  countryProgress!: Table<CountryProgressRow, string>;
  gameSessions!: Table<GameSessionRow, number>;
  challengeAttempts!: Table<ChallengeAttemptRow, number>;
  unlocks!: Table<UnlockRow, string>;
  meta!: Table<MetaRow, "meta">;
  outbox!: Table<OutboxRow, number>;
  sync_meta!: Table<SyncMetaRow, string>;
  concept_progress!: Table<ConceptProgressRow, string>;
  question_history!: Table<QuestionHistoryRow, string>;
  daily_summary!: Table<DailySummaryRow, string>;
  hardcore_progress!: Table<any, string>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      countryProgress: "key, iso3, skill, lastSeenAt, confidence",
      gameSessions: "++id, mode, skill, createdAt",
      meta: "id",
    });

    this.version(2)
      .stores({
        countryProgress: "iso3, lastSeenAt",
        gameSessions: "++id, mode, skill, createdAt, periodKey",
        unlocks: "key, unlockedAt",
        meta: "id",
      })
      .upgrade(async (tx) => {
        const old = await tx
          .table<{ key: string; iso3: string; skill: Skill } & SkillStat>(
            "countryProgress",
          )
          .toArray()
          .catch(() => []);
        const grouped = new Map<string, CountryProgressRow>();
        for (const row of old) {
          const existing = grouped.get(row.iso3) ?? {
            iso3: row.iso3,
            skills: {},
            lastSeenAt: 0,
          };
          existing.skills[row.skill] = {
            confidence: row.confidence,
            timesRight: row.timesRight,
            timesWrong: row.timesWrong,
            streak: row.streak,
            lastSeenAt: row.lastSeenAt,
          };
          existing.lastSeenAt = Math.max(existing.lastSeenAt, row.lastSeenAt);
          grouped.set(row.iso3, existing);
        }
        await tx.table("countryProgress").clear();
        if (grouped.size > 0) {
          await tx.table("countryProgress").bulkPut([...grouped.values()]);
        }
      });

    // v3: add sync-support fields and tables
    this.version(3).stores({
      countryProgress: "iso3, lastSeenAt, updated_at",
      gameSessions: "++id, &op_id, mode, skill, createdAt, periodKey, updated_at",
      challengeAttempts: "++id, &op_id, [kind+periodKey+questionIndex], createdAt",
      unlocks: "key, unlockedAt, updatedAt",
      meta: "id",
      outbox: "++id, &op_id, entity, status, next_attempt_at, created_at",
      sync_meta: "&key",
    });

    // v4: add FSRS tables
    this.version(4).stores({
      concept_progress: "conceptId, fsrs_due, dirty, updated_at",
      question_history: "op_id, conceptId, answeredAt",
      daily_summary: "dateKey, dirty",
    });

    // v5: auth-aware concept_progress — user_id + composite index for per-user queries
    this.version(5).stores({
      concept_progress: "conceptId, [user_id+skill], fsrs_due, dirty, updated_at",
    });

    // v6: re-add standalone skill index because the game engine queries it directly
    this.version(6).stores({
      concept_progress: "conceptId, [user_id+skill], skill, fsrs_due, dirty, updated_at",
    });

    // v7: add hardcore_progress table
    this.version(7).stores({
      hardcore_progress: "continent, updatedAt",
    });

    // v8: add indexes on question_history for mode/direction analytics;
    //     also bump meta schemaVersion and run string→numeric state migration
    this.version(8)
      .stores({
        question_history: "op_id, conceptId, answeredAt, mode, direction",
      })
      .upgrade(async (tx) => {
        // Migrate legacy string fsrs_state to official ts-fsrs numeric State
        const stateMap: Record<string, number> = {
          new: State.New,
          learning: State.Learning,
          review: State.Review,
          relearning: State.Relearning,
        };
        const rows = await tx.table<any>("concept_progress").toArray();
        const updates = rows
          .filter((r: any) => typeof r.fsrs_state === "string")
          .map((r: any) => ({
            ...r,
            fsrs_state: stateMap[r.fsrs_state as string] ?? State.New,
            fsrs_elapsed_days: r.fsrs_elapsed_days ?? 0,
            fsrs_scheduled_days: r.fsrs_scheduled_days ?? 0,
          }));
        if (updates.length > 0) {
          await tx.table("concept_progress").bulkPut(updates);
        }
      });

    // v9: Split FSRS memory traces by direction. Append default subMode to conceptId for existing data.
    this.version(9).upgrade(async (tx) => {
      const rows = await tx.table<ConceptProgressRow>("concept_progress").toArray();
      const updates = [];
      const deletes = [];
      for (const r of rows) {
        const parts = r.conceptId.split(":");
        if (parts.length === 2) {
          let newSubMode = "";
          if (r.skill === "capital") newSubMode = "countryToCap";
          else if (r.skill === "flag") newSubMode = "flagToCountry";
          else if (r.skill === "name") newSubMode = "name";
          else if (r.skill === "location") newSubMode = "find";
          
          if (newSubMode) {
            updates.push({ ...r, conceptId: `${r.conceptId}:${newSubMode}` });
            deletes.push(r.conceptId);
          }
        }
      }
      if (updates.length > 0) {
        await tx.table("concept_progress").bulkPut(updates);
        await tx.table("concept_progress").bulkDelete(deletes);
      }
      
      const history = await tx.table<QuestionHistoryRow>("question_history").toArray();
      const hUpdates = [];
      for (const h of history) {
        const parts = h.conceptId.split(":");
        if (parts.length === 2) {
          const skill = parts[1];
          let newSubMode = "";
          if (skill === "capital") newSubMode = "countryToCap";
          else if (skill === "flag") newSubMode = "flagToCountry";
          else if (skill === "name") newSubMode = "name";
          else if (skill === "location") newSubMode = "find";
          
          if (newSubMode) {
            hUpdates.push({ ...h, conceptId: `${h.conceptId}:${newSubMode}` });
          }
        }
      }
      if (hUpdates.length > 0) {
        await tx.table("question_history").bulkPut(hUpdates);
      }
    });
  }
}

export function createOrbitaDb(name: string): OrbitaDB {
  const d = new OrbitaDB(name);
  d.meta
    .put({ id: "meta", schemaVersion: 9, lastOpenedAt: Date.now(), prefs: {} })
    .catch(() => {});
  return d;
}

/**
 * Sync accessor used by all existing repo code. The first call opens the
 * local DB synchronously so repo code can keep its non-async API; auth-aware
 * swaps later replace the singleton via dbProvider.swap().
 */
import { getCurrent, setCurrent } from "./dbProvider";

export function db(): OrbitaDB {
  if (typeof window === "undefined") {
    throw new Error("Orbita DB is browser-only");
  }
  const cur = getCurrent();
  if (cur) return cur;
  const fresh = createOrbitaDb("orbita-local");
  setCurrent(fresh, "orbita-local");
  return fresh;
}

export function isBrowser() {
  return typeof window !== "undefined";
}
