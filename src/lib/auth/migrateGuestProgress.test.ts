// @vitest-environment jsdom
// Guest -> user merge: one transaction that also fills the outbox; the guest
// DB is deleted only after it commits, and a rerun adds nothing.
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import { State } from "ts-fsrs";
import { createOrbitaDb, type ConceptProgressRow, type OrbitaDB } from "@/lib/db/orbita-db";
import { isValidOpId } from "@/lib/sync/opId";
import { migrateGuestProgress } from "./migrateGuestProgress";

const T = Date.UTC(2026, 10, 6, 10, 0, 0);
const UID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function concept(id: string, extra: Partial<ConceptProgressRow> = {}): ConceptProgressRow {
  return {
    conceptId: id,
    iso3: id.slice(0, 3),
    skill: "capital",
    fsrs_state: State.Learning,
    fsrs_stability: 2,
    fsrs_difficulty: 5,
    fsrs_due: T + 600_000,
    fsrs_reps: 1,
    fsrs_lapses: 0,
    fsrs_last_review: T,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_learning_steps: 1,
    updated_at: T,
    version: 1,
    dirty: 1,
    ...extra,
  };
}
const stat = (confidence: number) => ({
  confidence,
  timesRight: 1,
  timesWrong: 0,
  streak: 1,
  lastSeenAt: T,
});

let guest: OrbitaDB;
let user: OrbitaDB;

async function seed() {
  guest = createOrbitaDb("orbita-local");
  // Guest review of FRA is newer than the user's; ESP's is older.
  await guest.concept_progress.bulkPut([
    concept("FRA:capital:countryToCap", { fsrs_last_review: T + 1000, fsrs_reps: 2 }),
    concept("ESP:capital:countryToCap", { fsrs_last_review: T - 1000, fsrs_reps: 9 }),
    concept("ITA:capital:countryToCap", { fsrs_last_review: 0, fsrs_state: State.New }),
  ]);
  await guest.question_history.put({
    op_id: crypto.randomUUID(),
    conceptId: "FRA:capital:countryToCap",
    sessionId: "s1",
    grade: 3,
    mode: "easy",
    direction: "country->capital",
    responseMs: 900,
    correct: true,
    answeredAt: T + 1000,
  });
  await guest.gameSessions.add({
    op_id: crypto.randomUUID(),
    mode: "capital",
    skill: "capital",
    score: 5,
    totalQuestions: 10,
    correct: 5,
    wrong: 5,
    bestCombo: 2,
    durationMs: 60_000,
    createdAt: T,
  });
  await guest.countryProgress.put({
    iso3: "FRA",
    skills: { flag: stat(0.4), capital: stat(0.9) },
    skill_versions: { flag: 1, capital: 1 },
    lastSeenAt: T + 5000,
  });
  await guest.unlocks.put({ key: "first", progress: 1, unlockedAt: T - 5000, updatedAt: T });
  guest.close();

  user = createOrbitaDb(`orbita-${UID}`);
  await user.concept_progress.bulkPut([
    concept("FRA:capital:countryToCap", { dirty: 0 }),
    concept("ESP:capital:countryToCap", { dirty: 0 }),
  ]);
  await user.countryProgress.put({
    iso3: "FRA",
    skills: { capital: stat(0.2) },
    skill_versions: { capital: 3 },
    lastSeenAt: T,
  });
  await user.unlocks.put({ key: "first", progress: 0.5, unlockedAt: null, updatedAt: T });
}

async function snapshot(d: OrbitaDB) {
  return {
    concepts: await d.concept_progress.toArray(),
    history: await d.question_history.toArray(),
    sessions: await d.gameSessions.toArray(),
    countries: await d.countryProgress.toArray(),
    unlocks: await d.unlocks.toArray(),
    outbox: await d.outbox.toArray(),
  };
}

beforeEach(async () => {
  await Dexie.delete("orbita-local");
  await Dexie.delete(`orbita-${UID}`);
  await seed();
});
afterEach(() => {
  vi.restoreAllMocks();
  user.close();
});

describe("migrateGuestProgress", () => {
  it("merges into a non-empty user DB and enqueues one op per merged row", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await migrateGuestProgress(user, UID);
    warn.mockRestore();

    // Latest review wins: FRA from the guest, ESP stays the user's.
    expect((await user.concept_progress.get("FRA:capital:countryToCap"))!.fsrs_last_review).toBe(T + 1000);
    expect((await user.concept_progress.get("ESP:capital:countryToCap"))!.fsrs_reps).toBe(1);
    // country: guest adds flag, user's capital keeps the higher version.
    const fra = (await user.countryProgress.get("FRA"))!;
    expect(fra.skills.flag!.confidence).toBe(0.4);
    expect(fra.skills.capital!.confidence).toBe(0.2);
    expect(fra.lastSeenAt).toBe(T + 5000);
    expect(await user.unlocks.get("first")).toMatchObject({ progress: 1, unlockedAt: T - 5000 });
    expect(await user.question_history.count()).toBe(1);
    expect(await user.gameSessions.count()).toBe(1);

    const out = await user.outbox.toArray();
    const by = (e: string) => out.filter((o) => o.entity === e);
    // ITA (never reviewed) is merged but not queued; ESP was not merged.
    expect(by("concept_progress").map((o) => o.payload.conceptId)).toEqual(["FRA:capital:countryToCap"]);
    expect(by("concept_progress")[0].payload.fsrs_learning_steps).toBe(1);
    expect(by("question_history")).toHaveLength(1);
    expect(by("sessions_log")).toHaveLength(1);
    expect(by("country_progress")[0].payload).toMatchObject({ country_code: "FRA", last_seen_at: T + 5000 });
    expect(by("unlocks")[0].payload).toMatchObject({ key: "first", progress: 1, unlocked_at: T - 5000 });
    expect(out).toHaveLength(5);
    for (const o of out) {
      expect(o.status).toBe("pending");
      expect(isValidOpId(o.op_id)).toBe(true);
      expect(typeof o.payload.client_id).toBe("string");
    }
    expect(await Dexie.exists("orbita-local")).toBe(false);
  });

  it("a failure mid-merge keeps orbita-local and leaves the user DB untouched", async () => {
    const before = await snapshot(user);
    vi.spyOn(user.outbox, "bulkAdd").mockRejectedValue(new Error("boom"));
    await migrateGuestProgress(user, UID);

    expect(await snapshot(user)).toEqual(before);
    expect(await Dexie.exists("orbita-local")).toBe(true);
    expect((await user.sync_meta.get("guest_merge_pending"))?.value).toBe("1");
  });

  it("a second call adds no rows and no ops", async () => {
    // First run commits but the delete never happens (blocked tab, closed page).
    vi.spyOn(Dexie, "delete").mockResolvedValueOnce(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await migrateGuestProgress(user, UID);
    const first = await snapshot(user);
    expect(first.outbox.length).toBeGreaterThan(0);
    expect(await Dexie.exists("orbita-local")).toBe(true);

    await migrateGuestProgress(user, UID);
    const second = await snapshot(user);
    expect(second).toEqual(first);
    expect(await Dexie.exists("orbita-local")).toBe(false);
  });
});
