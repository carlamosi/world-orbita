import { db } from "../db/orbita-db";
import type { ConceptProgressRow, SkillStat, Skill } from "../db/orbita-db";
import { createNewCard } from "./adapter";
import { State } from 'ts-fsrs';

/**
 * Seeds the new FSRS `concept_progress` table from the legacy SM-2 `countryProgress` table.
 * 
 * Formula mappings (SM-2 to FSRS-5 approximation):
 * - stability = max(1, interval * 0.9) (SM-2 intervals are slightly optimistic)
 * - difficulty = map(ef) from [1.3, 2.5] -> [10, 1] 
 * - due = nextReviewAt
 */
export async function seedFsrsFromSm2(): Promise<void> {
  const legacyRows = await db().countryProgress.toArray();
  const newConcepts: ConceptProgressRow[] = [];
  
  const now = Date.now();
  
  for (const row of legacyRows) {
    const iso3 = row.iso3;
    const skills = row.skills as Partial<Record<Skill, SkillStat>>;
    
    // We only migrate the 3 core concepts. "name" is legacy.
    for (const skill of ["location", "capital", "flag"] as Skill[]) {
      const stat = skills[skill];
      if (!stat) continue;
      
      const conceptId = `${iso3}:${skill}`;
      const fsrs = createNewCard();
      fsrs.reps = stat.timesRight + stat.timesWrong;
      
      if (stat.srs) {
        fsrs.state = State.Review;
        fsrs.due = new Date(stat.srs.nextReviewAt);
        fsrs.last_review = new Date(stat.srs.lastReviewedAt);
        fsrs.stability = Math.max(1, stat.srs.interval * 0.9);
        
        // SM-2 EF ranges roughly 1.3 (hard) to 2.5 (easy). FSRS D ranges 10 (hard) to 1 (easy).
        // Linear mapping: D = 10 - ((EF - 1.3) / 1.2) * 9
        const ef = Math.min(2.5, Math.max(1.3, stat.srs.ef));
        const difficulty = 10 - ((ef - 1.3) / 1.2) * 9;
        fsrs.difficulty = Math.max(1, Math.min(10, difficulty));
      } else if (stat.confidence > 0) {
        // Fallback for very old data without 'srs' object
        fsrs.state = State.Review;
        fsrs.stability = Math.max(1, stat.confidence * 10);
        fsrs.difficulty = 5;
        fsrs.due = new Date(stat.lastSeenAt + (fsrs.stability * 86400000));
        fsrs.last_review = new Date(stat.lastSeenAt);
      }
      
      newConcepts.push({
        conceptId,
        iso3,
        skill,
        fsrs_state: fsrs.state as any,
        fsrs_stability: fsrs.stability,
        fsrs_difficulty: fsrs.difficulty,
        fsrs_due: fsrs.due.getTime(),
        fsrs_reps: fsrs.reps,
        fsrs_lapses: stat.timesWrong,
        fsrs_last_review: fsrs.last_review?.getTime() ?? now,
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
        updated_at: now,
        version: 1,
        dirty: 1 // Trigger sync for the newly seeded FSRS rows
      });
    }
  }
  
  if (newConcepts.length > 0) {
    await db().transaction("rw", db().concept_progress, async () => {
      // Use put to avoid throwing on duplicate keys if migration runs twice
      await db().concept_progress.bulkPut(newConcepts);
    });
    console.log(`Migrated ${newConcepts.length} concepts from SM-2 to FSRS.`);
  }
}

/**
 * Migrates ORBITA's custom FSRS-5 string states ('new', 'learning', 'review', 'relearning')
 * to the official ts-fsrs numeric State enum.
 */
export async function migrateCustomFsrsToOfficial(): Promise<void> {
  const allRows = await db().concept_progress.toArray();
  const updates: ConceptProgressRow[] = [];
  
  const stateMap: Record<string, State> = {
    'new': State.New,
    'learning': State.Learning,
    'review': State.Review,
    'relearning': State.Relearning
  };

  for (const row of allRows) {
    if (typeof row.fsrs_state === 'string') {
      const numericState = stateMap[row.fsrs_state as string] ?? State.New;
      updates.push({
        ...row,
        fsrs_state: numericState,
        fsrs_elapsed_days: row.fsrs_elapsed_days ?? 0,
        fsrs_scheduled_days: row.fsrs_scheduled_days ?? 0,
        dirty: 1 // Trigger sync
      });
    }
  }

  if (updates.length > 0) {
    await db().transaction("rw", db().concept_progress, async () => {
      await db().concept_progress.bulkPut(updates);
    });
    console.log(`Migrated ${updates.length} concept_progress rows to official ts-fsrs numeric states.`);
  }
}
