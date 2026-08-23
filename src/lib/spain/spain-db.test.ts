import { describe, it, expect } from "vitest";
import { formatConceptId, parseConceptId } from "@/lib/fsrs/concept";
import { SPAIN_CCAA, SPAIN_PROVINCES, SPAIN_ALL } from "@/lib/spain";
import { isConceptDue, generateDueTodayQueue, getDueTodayCount } from "@/lib/fsrs/planner";
import { rowToCard, cardToRowUpdates, processReview } from "@/lib/fsrs/adapter";
import { assess } from "@/lib/fsrs/assessment";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";

describe("Spain Database & FSRS Persistence Verification", () => {
  it("generates valid, collision-free concept IDs for all 19 CCAA across all skills", () => {
    const skills = ["location", "name", "flag", "capital"] as const;
    const generatedIds = new Set<string>();

    for (const ccaa of SPAIN_CCAA) {
      for (const skill of skills) {
        const conceptId = formatConceptId({
          domain: "spain",
          entityId: ccaa.id,
          skill,
          subMode: "default",
        });

        expect(conceptId).toMatch(/^spain:ES-[A-Z]{2}:(location|name|flag|capital):default$/);
        expect(generatedIds.has(conceptId)).toBe(false);
        generatedIds.add(conceptId);

        const parsed = parseConceptId(conceptId);
        expect(parsed.domain).toBe("spain");
        expect(parsed.entityId).toBe(ccaa.id);
        expect(parsed.skill).toBe(skill);
      }
    }

    expect(generatedIds.size).toBe(19 * 4);
  });

  it("generates valid, collision-free concept IDs for all 50 provinces across all skills", () => {
    const skills = ["location", "name", "capital"] as const;
    const generatedIds = new Set<string>();

    for (const province of SPAIN_PROVINCES) {
      for (const skill of skills) {
        const conceptId = formatConceptId({
          domain: "spain",
          entityId: province.id,
          skill,
          subMode: "default",
        });

        expect(conceptId).toMatch(/^spain:ES-[A-Z0-9]{1,3}:(location|name|capital):default$/);
        expect(generatedIds.has(conceptId)).toBe(false);
        generatedIds.add(conceptId);

        const parsed = parseConceptId(conceptId);
        expect(parsed.domain).toBe("spain");
        expect(parsed.entityId).toBe(province.id);
        expect(parsed.skill).toBe(skill);
      }
    }

    expect(generatedIds.size).toBe(50 * 3);
  });

  it("correctly simulates FSRS review lifecycle for Spain entity", () => {
    const initialRow: ConceptProgressRow = {
      conceptId: "spain:ES-AN:flag:default",
      iso3: "ES-AN",
      skill: "flag",
      fsrs_state: State.New,
      fsrs_stability: null,
      fsrs_difficulty: null,
      fsrs_due: 0,
      fsrs_reps: 0,
      fsrs_lapses: 0,
      fsrs_last_review: 0,
      updated_at: Date.now(),
      version: 1,
      dirty: 0,
    };

    // Assessment: correct answer
    const assessment = assess({
      validationResult: { correct: true, softCorrect: false },
      responseMs: 1200,
      attemptNumber: 1,
      hintsUsed: 0,
      questionType: "flag",
      retrievalMode: "easy",
      direction: "flag->answer",
    });

    expect(assessment.outcome).toBe("easy");

    const now = Date.now();
    const card = rowToCard(initialRow);
    const { card: nextCard } = processReview(card, assessment.outcome, now);

    const updatedRow: ConceptProgressRow = {
      ...initialRow,
      ...cardToRowUpdates(nextCard, 1, true, initialRow.version),
    };

    expect(updatedRow.fsrs_reps).toBe(1);
    expect(updatedRow.fsrs_state).toBeGreaterThanOrEqual(1);
    expect(updatedRow.fsrs_stability).toBeGreaterThan(0);
    expect(updatedRow.fsrs_difficulty).toBeGreaterThan(0);
    expect(updatedRow.fsrs_due).toBeGreaterThan(now);
    expect(updatedRow.version).toBe(2);
    expect(updatedRow.dirty).toBe(1);
  });

  it("Due Today planner accurately detects due vs future Spain cards", () => {
    const now = Date.now();
    const rows: ConceptProgressRow[] = [
      // 1. Due today: State.New
      {
        conceptId: "spain:ES-CT:flag:default",
        iso3: "ES-CT",
        skill: "flag",
        fsrs_state: State.New,
        fsrs_stability: null,
        fsrs_difficulty: null,
        fsrs_due: 0,
        fsrs_reps: 0,
        fsrs_lapses: 0,
        fsrs_last_review: 0,
        updated_at: now,
        version: 1,
        dirty: 0,
      },
      // 2. Due today: overdue Review card (due in past)
      {
        conceptId: "spain:ES-MD:capital:default",
        iso3: "ES-MD",
        skill: "capital",
        fsrs_state: State.Review,
        fsrs_stability: 3.5,
        fsrs_difficulty: 4.2,
        fsrs_due: now - 3600_000,
        fsrs_reps: 3,
        fsrs_lapses: 0,
        fsrs_last_review: now - 86400_000 * 3,
        updated_at: now,
        version: 3,
        dirty: 0,
      },
      // 3. Not due today: scheduled for tomorrow
      {
        conceptId: "spain:ES-GA:location:default",
        iso3: "ES-GA",
        skill: "location",
        fsrs_state: State.Review,
        fsrs_stability: 5.0,
        fsrs_difficulty: 3.8,
        fsrs_due: now + 86400_000,
        fsrs_reps: 4,
        fsrs_lapses: 0,
        fsrs_last_review: now,
        updated_at: now,
        version: 4,
        dirty: 0,
      },
    ];

    expect(isConceptDue(rows[0]!, now)).toBe(true);
    expect(isConceptDue(rows[1]!, now)).toBe(true);
    expect(isConceptDue(rows[2]!, now)).toBe(false);

    expect(getDueTodayCount(rows, now)).toBe(2);

    const queue = generateDueTodayQueue(rows, now);
    expect(queue).toHaveLength(2);
    expect(queue.map((r) => r.conceptId)).toContain("spain:ES-CT:flag:default");
    expect(queue.map((r) => r.conceptId)).toContain("spain:ES-MD:capital:default");
    expect(queue.map((r) => r.conceptId)).not.toContain("spain:ES-GA:location:default");
  });
});
