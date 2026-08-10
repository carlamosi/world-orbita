import { create, type StoreApi, type UseBoundStore } from "zustand";
import { COUNTRIES } from "@/lib/countries";
import type { Country } from "@/types/country";
import { generateSessionQueue } from "@/lib/fsrs/planner";
import { assess } from "@/lib/fsrs/assessment";
import { rowToCard, cardToRowUpdates, processReview } from "@/lib/fsrs/adapter";
import { recordConceptAttempt } from "@/lib/db/progressRepo";
import { db, type ConceptProgressRow, type GameMode, type Skill } from "@/lib/db/orbita-db";
import { recordSessionEnd } from "@/lib/db/repo";
import { State } from "ts-fsrs";

export type AnswerState = "idle" | "correct" | "wrong" | "revealed";
export const QUESTIONS_PER_SESSION = 20;

export interface SessionState {
  queue: Country[];
  conceptQueue: (ConceptProgressRow | null)[];
  index: number;
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  answerState: AnswerState;
  startedAt: number;
  endedAt: number | null;
  loading: boolean;
  /** Epoch ms when the current question became visible. */
  questionStartedAt: number;

  current(): Country | null;
  /** Start a session. Pass `allCountries` for Complete Continent mode
   * (every country played exactly once in random order). Pass `continent`
   * for Quick Practice (20 weighted questions). Pass `conceptRows` to
   * supply a pre-built mixed-skill FSRS queue (used by Due Today). */
  start(opts?: {
    continent?: string;
    allCountries?: Country[];
    /** Pre-built FSRS rows — bypasses the planner entirely. */
    conceptRows?: ConceptProgressRow[];
  }): Promise<void>;
  submit(isCorrect: boolean): void;
  reveal(): void;
  next(): void;
}

interface CreateOpts {
  mode: GameMode;
  skill: Skill;
  questions?: number;
}

/**
 * Shared turn-based session engine for Find / Name / Flags / Capitals and
 * Weekly Challenge. Speed Round does NOT extend this — it uses its own
 * runtime store (see `src/features/speed/speedRuntimeStore.ts`) because
 * timer ticks and combo decay have very different re-render constraints.
 */
export function createSessionStore({
  mode,
  skill,
  questions = QUESTIONS_PER_SESSION,
}: CreateOpts): UseBoundStore<StoreApi<SessionState>> {
  return create<SessionState>((set, get) => ({
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
        questionStartedAt: 0,
      });

      let q: Country[] = [];
      let cq: (ConceptProgressRow | null)[] = [];
      
      if (opts?.conceptRows && opts.conceptRows.length > 0) {
        // Due Today / pre-built mode: skip the planner, use the caller's queue directly.
        const isoToCountry = new Map(COUNTRIES.map(c => [c.iso3, c]));
        cq = opts.conceptRows;
        q = cq.map(c => (c ? isoToCountry.get(c.iso3) : null)).filter((c): c is Country => c != null);
      } else if (opts?.allCountries && opts.allCountries.length > 0) {
        // Complete Continent mode: use the pre-built shuffled array directly.
        q = [...opts.allCountries];
        for (let i = q.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q[i], q[j]] = [q[j]!, q[i]!];
        }
        cq = Array(q.length).fill(null);
      } else {
        // FSRS session planner
        const allConcepts = await db().concept_progress.where("skill").equals(skill).toArray();
        let pool = allConcepts;
        
        if (opts?.continent && opts.continent !== "All") {
          const validIso3s = new Set(COUNTRIES.filter(c => c.continent === opts.continent).map(c => c.iso3));
          pool = allConcepts.filter(c => validIso3s.has(c.iso3));
        }
        
        // If there are not enough concepts seeded yet (e.g. fresh install), create dummy ones
        if (pool.length < questions) {
          const used = new Set(pool.map(c => c.iso3));
          const candidates = COUNTRIES.filter(c => !opts?.continent || opts.continent === "All" || c.continent === opts.continent);
          for (const c of candidates) {
            if (pool.length >= questions) break;
            if (!used.has(c.iso3)) {
              pool.push({
                conceptId: `${c.iso3}:${skill}`,
                iso3: c.iso3,
                skill,
                fsrs_state: State.New as any,
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
        
        const plannedConcepts = generateSessionQueue(pool, undefined, { sessionSize: questions });
        
        const isoToCountry = new Map(COUNTRIES.map(c => [c.iso3, c]));
        q = plannedConcepts.map(c => isoToCountry.get(c.iso3)!).filter(Boolean);
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
        questionStartedAt: now,
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
          answerState: "correct",
        });
      } else {
        set({ combo: 0, wrong: s.wrong + 1, answerState: "wrong" });
      }
      
      // FSRS — process via official adapter (ts-fsrs)
        if (targetConcept) {
          const now = Date.now();
          // Step 1: Evaluate the answer (behavioral signals, pure)
          const assessment = assess({
            validationResult: { correct: isCorrect, softCorrect: false },
            responseMs,
            attemptNumber: 1,
            hintsUsed: 0,
            questionType: skill,
            retrievalMode: "easy", // caller can pass this in via opts later
            direction: `${skill}->answer`,
          });

          // Step 2: Process through official FSRS-6 (adapter → ts-fsrs.next())
          const currentCard = rowToCard(targetConcept);
          const { card: nextCard, log: fsrsLog } = processReview(
            currentCard,
            assessment.outcome,
            now,
          );

          // Step 3: Apply card updates back to the row
          const updatedProgressRow: ConceptProgressRow = {
            ...targetConcept,
            ...cardToRowUpdates(nextCard, 1, true, targetConcept.version),
          };

          // Step 4: Persist — idempotent via op_id; fsrs_log stored for audit
          recordConceptAttempt(
            updatedProgressRow,
            {
              op_id: crypto.randomUUID(),
              conceptId: targetConcept.conceptId,
              sessionId: "session-" + s.startedAt,
              grade: assessment.outcome === "incorrect" ? 0 : assessment.outcome === "ambiguous" ? 1 : 2,
              mode: assessment.retrievalMode,
              direction: assessment.direction,
              fsrs_log: JSON.stringify({ grade: fsrsLog.log.rating, due: fsrsLog.card.due }),
              responseMs,
              correct: isCorrect,
              answeredAt: now,
            },
          ).catch(console.error);

          // Step 5: Optimistic local update (no network wait) — via set() to keep Zustand reactive
          const newConceptQueue = [...s.conceptQueue];
          newConceptQueue[s.index] = updatedProgressRow;
          set({ conceptQueue: newConceptQueue });
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
          createdAt: endedAt,
        });
        // Signal the SaveProgressNudge for guest users
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("orbita:session-end", { detail: { score: s.score, correct: s.correct } }));
        }
        return;
      }
      set({
        index: nextIndex,
        answerState: "idle",
        questionStartedAt: Date.now(),
      });
    },
  }));
}
