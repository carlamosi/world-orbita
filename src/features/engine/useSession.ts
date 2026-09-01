import { create, type StoreApi, type UseBoundStore } from "zustand";
import { COUNTRIES } from "@/lib/countries";
import type { Country } from "@/types/country";
import { generateSessionQueue } from "@/lib/fsrs/planner";
import { assess } from "@/lib/fsrs/assessment";
import { rowToCard, cardToRowUpdates, processReview, getFsrsParameters } from "@/lib/fsrs/adapter";
import { recordConceptAttempt } from "@/lib/db/progressRepo";
import { db, type ConceptProgressRow, type GameMode, type Skill } from "@/lib/db/orbita-db";
import { recordSessionEnd } from "@/lib/db/repo";
import { playAnswerSound } from "@/lib/audio";
import { State, ConvertStepUnitToMinutes } from "ts-fsrs";
import { formatConceptId, parseConceptId } from "@/lib/fsrs/concept";

/**
 * Spacing by item-count: re-insert failed card after N other answered cards
 * (default N=6, clamped to remaining queue room).
 */
export const DEFAULT_RELEARNING_OFFSET = 6;

function stepToQueueOffset(_stepUnit: string, remainingCards: number, countSpacing = DEFAULT_RELEARNING_OFFSET): number {
  return Math.max(2, Math.min(countSpacing, Math.max(2, remainingCards)));
}

export type AnswerState = "idle" | "correct" | "wrong" | "revealed";
export const QUESTIONS_PER_SESSION = 10;

export interface MissedItem {
  id: string;
  prompt: string;
  answer: string;
  flagIso2?: string;
  subMode?: string;
}

export interface SessionItemLike {
  id?: string;
  iso3?: string;
  iso2?: string;
  flagCode?: string;
  name: string;
  capital?: string | null;
  coordinates?: [number, number];
  capitalCoords?: [number, number];
  continent?: string;
}

export interface SessionState<TItem = Country> {
  queue: TItem[];
  conceptQueue: (ConceptProgressRow | null)[];
  index: number;
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  masteredCount: number;
  missedItems: MissedItem[];
  answerState: AnswerState;
  startedAt: number;
  endedAt: number | null;
  loading: boolean;
  /** Epoch ms when the current question became visible. */
  questionStartedAt: number;

  /**
   * conceptIds that have already been written to FSRS in this session.
   * Prevents double-scoring re-queued retries.
   */
  fsrsUpdatedIds: Set<string>;

  /**
   * Tracks how many times each conceptId has been re-queued within this
   * session after an incorrect answer.
   * - 0 / absent → never re-queued
   * - 1           → one requeue remaining (step 1 consumed)
   * - 2           → two requeues used (step 2 consumed; no more requeues)
   *
   * We allow at most `relearning_steps.length` in-session retries so a
   * persistently wrong card cannot loop forever.
   */
  inSessionRetries: Map<string, number>;

  current(): TItem | null;
  /** Start a session. Pass `allCountries` or `items` for Complete Continent/Region mode
   * (every item played exactly once in random order). Pass `continent`
   * for Quick Practice (20 weighted questions). Pass `conceptRows` to
   * supply a pre-built mixed-skill FSRS queue (used by Due Today). */
  start(opts?: {
    continent?: string;
    subMode?: string;
    allCountries?: TItem[];
    items?: TItem[];
    /** Pre-built FSRS rows — bypasses the planner entirely. */
    conceptRows?: ConceptProgressRow[];
  }): Promise<void>;
  submit(isCorrect: boolean, opts?: { retrievalMode?: "easy" | "hard" }): void;
  reveal(): void;
  next(): void;
}

export interface CreateOpts<TItem = Country> {
  mode: GameMode;
  skill: Skill;
  questions?: number;
  domain?: string;
  dataset?: readonly TItem[];
  getId?: (item: TItem) => string;
}

/**
 * Shared turn-based session engine for Find / Name / Flags / Capitals and
 * Weekly Challenge. Speed Round does NOT extend this — it uses its own
 * runtime store (see `src/features/speed/speedRuntimeStore.ts`) because
 * timer ticks and combo decay have very different re-render constraints.
 */
export function createSessionStore<TItem = Country>({
  mode,
  skill,
  questions = QUESTIONS_PER_SESSION,
  domain = "world",
  dataset,
  getId,
}: CreateOpts<TItem>): UseBoundStore<StoreApi<SessionState<TItem>>> {
  const activeDataset = (dataset ?? COUNTRIES) as unknown as readonly TItem[];
  const resolveId = getId ?? ((item: TItem) => {
    const raw = item as unknown as SessionItemLike;
    return raw.id ?? raw.iso3 ?? raw.name;
  });

  return create<SessionState<TItem>>((set, get) => ({
    queue: [],
    conceptQueue: [],
    index: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    masteredCount: 0,
    missedItems: [],
    answerState: "idle",
    startedAt: 0,
    endedAt: null,
    loading: false,
    questionStartedAt: 0,
    fsrsUpdatedIds: new Set(),
    inSessionRetries: new Map(),

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
        masteredCount: 0,
        missedItems: [],
        answerState: "idle",
        startedAt: 0,
        endedAt: null,
        questionStartedAt: 0,
        fsrsUpdatedIds: new Set(),
        inSessionRetries: new Map(),
      });

      let q: TItem[] = [];
      let cq: (ConceptProgressRow | null)[] = [];

      const itemMap = new Map<string, TItem>();
      for (const item of activeDataset) {
        const raw = item as unknown as SessionItemLike;
        const id = resolveId(item);
        itemMap.set(id, item);
        if (raw.iso3) itemMap.set(raw.iso3, item);
      }

      if (opts?.conceptRows && opts.conceptRows.length > 0) {
        // Due Today / pre-built mode: skip the planner, use the caller's queue directly.
        cq = opts.conceptRows;
        const rows: TItem[] = [];
        for (const c of opts.conceptRows) {
          if (!c) continue;
          const parsed = parseConceptId(c.conceptId);
          const found = itemMap.get(parsed.entityId) ?? itemMap.get(c.iso3);
          if (found) rows.push(found);
        }
        q = rows;
      } else if ((opts?.items && opts.items.length > 0) || (opts?.allCountries && opts.allCountries.length > 0)) {
        // Complete mode: use the pre-built shuffled array directly.
        const source = (opts.items ?? opts.allCountries)!;
        q = [...source];
        for (let i = q.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q[i], q[j]] = [q[j]!, q[i]!];
        }

        // Populate cq with existing FSRS progress rows from DB, or initialize State.New
        const allDbConcepts = await db().concept_progress.where("skill").equals(skill).toArray();
        const dbConceptMap = new Map(allDbConcepts.map((c) => [c.conceptId, c]));

        let defaultSubMode = "";
        if (skill === "capital") defaultSubMode = "countryToCap";
        if (skill === "flag") defaultSubMode = "flagToCountry";
        if (skill === "name") defaultSubMode = "name";
        if (skill === "location") defaultSubMode = "find";
        const sm = opts?.subMode && opts.subMode !== "mixed" ? opts.subMode : defaultSubMode;

        cq = q.map((item) => {
          const raw = item as unknown as SessionItemLike;
          const entityId = resolveId(item);
          const conceptId = formatConceptId({
            domain: domain as any,
            entityId,
            skill,
            subMode: sm || "default",
          });
          const existing = dbConceptMap.get(conceptId);
          if (existing) return existing;
          return {
            conceptId,
            iso3: raw.iso3 ?? entityId,
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
            dirty: 0,
          };
        });
      } else {
        // FSRS session planner
        const allConcepts = await db().concept_progress.where("skill").equals(skill).toArray();
        let pool = allConcepts;

        // Filter pool by domain if specified
        if (domain && domain !== "world") {
          pool = pool.filter(c => c.conceptId.startsWith(`${domain}:`));
        } else if (domain === "world") {
          // World domain: either legacy (no domain prefix) or explicitly world:
          pool = pool.filter(c => !c.conceptId.includes(":") || !c.conceptId.startsWith("spain:"));
        }
        
        if (opts?.continent && opts.continent !== "All") {
          const validIds = new Set(
            activeDataset
              .filter(c => (c as unknown as SessionItemLike).continent === opts.continent)
              .map(c => resolveId(c))
          );
          pool = allConcepts.filter(c => {
            const parsed = parseConceptId(c.conceptId);
            return validIds.has(parsed.entityId) || validIds.has(c.iso3);
          });
        }

        if (opts?.subMode && opts.subMode !== "mixed") {
          pool = pool.filter(c => c.conceptId.endsWith(`:${opts.subMode}`));
        }
        
        // If there are not enough concepts seeded yet (e.g. fresh install), create dummy ones
        if (pool.length < questions) {
          const used = new Set(pool.map(c => parseConceptId(c.conceptId).entityId));
          const candidates = activeDataset.filter(c => {
            const raw = c as unknown as SessionItemLike;
            return !opts?.continent || opts.continent === "All" || raw.continent === opts.continent;
          });
          for (const c of candidates) {
            if (pool.length >= questions) break;
            const entityId = resolveId(c);
            const raw = c as unknown as SessionItemLike;
            if (!used.has(entityId)) {
              // For mixed mode, default to a standard subMode if we must seed, or use provided subMode
              let defaultSubMode = "";
              if (skill === "capital") defaultSubMode = "countryToCap";
              if (skill === "flag") defaultSubMode = "flagToCountry";
              if (skill === "name") defaultSubMode = "name";
              if (skill === "location") defaultSubMode = "find";
              
              const sm = (opts?.subMode && opts.subMode !== "mixed") ? opts.subMode : defaultSubMode;
              const newConceptId = formatConceptId({
                domain: domain as any,
                entityId,
                skill,
                subMode: sm || "default",
              });
              
              pool.push({
                conceptId: newConceptId,
                iso3: raw.iso3 ?? entityId,
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
              used.add(entityId);
            }
          }
        }
        
        const plannedConcepts = generateSessionQueue(pool, undefined, { sessionSize: questions });
        const plannedItems: TItem[] = [];
        for (const c of plannedConcepts) {
          const parsed = parseConceptId(c.conceptId);
          const found = itemMap.get(parsed.entityId) ?? itemMap.get(c.iso3);
          if (found) plannedItems.push(found);
        }
        q = plannedItems;
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
        fsrsUpdatedIds: new Set(),
        inSessionRetries: new Map(),
      });
    },

    submit(isCorrect, submitOpts) {
      const s = get();
      if (s.answerState !== "idle") return;
      playAnswerSound(isCorrect);
      const target = s.queue[s.index];
      const targetConcept = s.conceptQueue[s.index];
      if (!target) return;

      const responseMs = Math.max(0, Date.now() - (s.questionStartedAt || Date.now()));

      // ── Accumulate all state updates into one set() call ──────────────────
      const updates: Partial<SessionState<TItem>> = {};

      // 1. Score & UI state
      if (isCorrect) {
        const combo = s.combo + 1;
        updates.score = s.score + 100 + Math.min(s.combo, 9) * 20;
        updates.combo = combo;
        updates.bestCombo = Math.max(s.bestCombo, combo);
        updates.correct = s.correct + 1;
        updates.answerState = "correct";
        // If it's the first time seeing this item or FSRS not yet updated, count towards mastered/progressed
        if (!targetConcept || !s.fsrsUpdatedIds.has(targetConcept.conceptId)) {
          updates.masteredCount = (s.masteredCount ?? 0) + 1;
        }
      } else {
        updates.combo = 0;
        updates.wrong = s.wrong + 1;
        updates.answerState = "wrong";

        // Track missed item details for end session review
        const conceptSkill = targetConcept?.skill ?? skill;
        const parts = targetConcept?.conceptId.split(":") ?? [];
        const dir = parts.length >= 3 ? parts[parts.length - 1]! : `${conceptSkill}->answer`;

        const rawTarget = target as unknown as SessionItemLike;
        let prompt = rawTarget.name;
        let answer = rawTarget.name;

        if (conceptSkill === "capital") {
          if (dir === "capToCountry") {
            prompt = rawTarget.capital ?? rawTarget.name;
            answer = rawTarget.name;
          } else {
            prompt = rawTarget.name;
            answer = rawTarget.capital ?? "—";
          }
        } else if (conceptSkill === "flag") {
          prompt = rawTarget.name;
          answer = rawTarget.name;
        } else if (conceptSkill === "location") {
          prompt = rawTarget.name;
          answer = rawTarget.capital ? `${rawTarget.name} (${rawTarget.capital})` : rawTarget.name;
        } else if (conceptSkill === "name") {
          prompt = rawTarget.name;
          answer = rawTarget.name;
        }

        const targetId = resolveId(target);
        const flagCode = rawTarget.flagCode ?? rawTarget.iso2;
        const missedKey = targetConcept?.conceptId ?? formatConceptId({
          domain: domain as any,
          entityId: targetId,
          skill: conceptSkill,
          subMode: dir,
        });

        if (!s.missedItems.some((m) => m.id === missedKey)) {
          updates.missedItems = [
            ...s.missedItems,
            {
              id: missedKey,
              prompt,
              answer,
              flagIso2: flagCode,
              subMode: dir,
            },
          ];
        }
      }

      // 2. FSRS update — only the FIRST attempt per conceptId per session counts.
      //    Retries are for in-session desirable-difficulty practice; FSRS state
      //    is already committed from the first answer and must not be double-scored.
      let effectiveConcept = targetConcept;
      if (!effectiveConcept) {
        const rawTarget = target as unknown as SessionItemLike;
        const targetId = resolveId(target);
        const conceptSkill = skill;
        const subModeMap: Record<string, string> = {
          capital: "countryToCap",
          flag: "flagToCountry",
          location: "find",
          name: "name",
        };
        const defaultSubMode = subModeMap[conceptSkill] ?? conceptSkill;
        const conceptId = formatConceptId({
          domain: domain as any,
          entityId: targetId,
          skill: conceptSkill,
          subMode: defaultSubMode,
        });
        effectiveConcept = {
          conceptId,
          iso3: rawTarget.iso3 ?? targetId,
          skill: conceptSkill,
          fsrs_state: State.New as any,
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
      }

      if (effectiveConcept && !s.fsrsUpdatedIds.has(effectiveConcept.conceptId)) {
        const now = Date.now();

        // Use the concept's own skill (critical for Due Today mixed sessions)
        const conceptSkill = effectiveConcept.skill ?? skill;
        const parts = effectiveConcept.conceptId.split(":");
        const actualDirection = parts.length >= 3 ? parts[parts.length - 1]! : `${conceptSkill}->answer`;

        const assessment = assess({
          validationResult: { correct: isCorrect, softCorrect: false },
          responseMs,
          attemptNumber: 1,
          hintsUsed: 0,
          questionType: conceptSkill,
          retrievalMode: submitOpts?.retrievalMode ?? "easy",
          direction: actualDirection,
        });

        const currentCard = rowToCard(effectiveConcept);
        const { card: nextCard, log: fsrsLog } = processReview(
          currentCard,
          assessment.outcome,
          now,
        );

        const updatedProgressRow: ConceptProgressRow = {
          ...effectiveConcept,
          ...cardToRowUpdates(nextCard, 1, true, effectiveConcept.version),
        };

        // Persist async — idempotent via op_id
        recordConceptAttempt(updatedProgressRow, {
          op_id: crypto.randomUUID(),
          conceptId: effectiveConcept.conceptId,
          sessionId: "session-" + s.startedAt,
          grade: assessment.outcome === "again" ? 0 : assessment.outcome === "hard" ? 1 : assessment.outcome === "good" ? 2 : 3,
          mode: assessment.retrievalMode,
          direction: assessment.direction,
          fsrs_log: JSON.stringify({ grade: fsrsLog.log.rating, due: fsrsLog.card.due }),
          responseMs,
          correct: isCorrect,
          answeredAt: now,
        }).catch(console.error);

        // Mark this concept as FSRS-updated for this session
        const nextFsrsUpdatedIds = new Set(s.fsrsUpdatedIds);
        nextFsrsUpdatedIds.add(effectiveConcept.conceptId);
        updates.fsrsUpdatedIds = nextFsrsUpdatedIds;

        // Optimistic row update at the current index position
        const baseConceptQueue = [...s.conceptQueue];
        baseConceptQueue[s.index] = updatedProgressRow;
        updates.conceptQueue = baseConceptQueue;
      }

      // 3. Desirable-difficulty re-queue for incorrect answers.
      //
      //    Principle (Bjork): a short-delay retrieval attempt after failure
      //    strengthens memory far more than immediate repetition. We re-insert
      //    the card a few positions ahead using FSRS relearning_steps as the
      //    guide for how far ahead ("1m" ≈ 4 cards at ~15 s/card).
      //
      //    Rules:
      //    - Only re-queue on incorrect answers.
      //    - At most relearning_steps.length re-queues per concept per session
      //      (prevents infinite loops for persistently wrong cards).
      //    - The re-queued slot contains the UPDATED concept row (post-FSRS),
      //      but FSRS will NOT be called again when that slot is answered
      //      (protected by fsrsUpdatedIds).
      //    - If there are fewer than 3 cards left in the queue, don't re-queue
      //      (not enough room for meaningful interleaving).
      if (!isCorrect && targetConcept) {
        const conceptId = targetConcept.conceptId;
        const retries = s.inSessionRetries.get(conceptId) ?? 0;
        const relearningSteps = getFsrsParameters().relearning_steps;
        const maxRetries = relearningSteps.length;

        const remainingAfterCurrent = s.queue.length - s.index - 1;

        if (retries < maxRetries && remainingAfterCurrent >= 3) {
          // Use the step corresponding to this retry attempt
          const stepUnit = relearningSteps[retries] ?? relearningSteps[relearningSteps.length - 1]!;
          const offset = stepToQueueOffset(String(stepUnit), remainingAfterCurrent);

          // Clamp to the end of the queue (splice inserts before that index)
          const insertAt = Math.min(s.index + 1 + offset, s.queue.length);

          // Build new queues with the failed card re-inserted
          const newQueue = [...(updates.queue ?? s.queue)];
          const newConceptQueue = [...(updates.conceptQueue ?? s.conceptQueue)];

          newQueue.splice(insertAt, 0, target);
          newConceptQueue.splice(insertAt, 0, newConceptQueue[s.index] ?? null);

          updates.queue = newQueue;
          updates.conceptQueue = newConceptQueue;

          // Record the retry count
          const nextRetries = new Map(s.inSessionRetries);
          nextRetries.set(conceptId, retries + 1);
          updates.inSessionRetries = nextRetries;
        }
      }

      // Single atomic update — prevents double-render race conditions
      set(updates);
    },

    reveal() {
      const s = get();
      if (s.answerState === "idle") {
        s.submit(false);
      }
      set({ answerState: "revealed" });
    },

    next() {
      const s = get();
      const nextIndex = s.index + 1;
      if (nextIndex >= s.queue.length) {
        const endedAt = Date.now();
        set({ endedAt, answerState: "idle", combo: 0 });
        // totalQuestions = unique cards graded (not raw queue length, which grows
        // when re-queue slots are inserted for desirable-difficulty retries)
        const uniqueGraded = s.fsrsUpdatedIds.size || s.queue.length;
        recordSessionEnd({
          mode,
          skill,
          score: s.score,
          totalQuestions: uniqueGraded,
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
