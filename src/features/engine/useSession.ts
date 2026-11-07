import { create, type StoreApi, type UseBoundStore } from "zustand";
import { COUNTRIES } from "@/lib/countries";
import type { Country } from "@/types/country";
import { generateSessionQueue } from "@/lib/fsrs/planner";
import { assess } from "@/lib/fsrs/assessment";
import {
  rowToCard,
  cardToRowUpdates,
  processReview,
  getFsrsParameters,
  getRetrievability,
  isMastered,
  normalizeState,
} from "@/lib/fsrs/adapter";
import { recordConceptAttempt } from "@/lib/db/progressRepo";
import { db, type ConceptProgressRow, type GameMode, type Skill } from "@/lib/db/orbita-db";
import { recordSessionEnd } from "@/lib/db/repo";
import { adaptiveNewLimit, missFeedbackMs, readRecentFirstTries } from "./learningLoad";
import { playAnswerSound } from "@/lib/audio";
import { State, ConvertStepUnitToMinutes } from "ts-fsrs";
import { formatConceptId, parseConceptId } from "@/lib/fsrs/concept";
import type { GeoDomain } from "@/types/geo";

/**
 * Spacing by item-count: re-insert failed card after N other answered cards
 * (default N=6, clamped to remaining queue room).
 */
export const DEFAULT_RELEARNING_OFFSET = 6;

/** A contrast question comes this many answered cards after the confusion, at most this often per session. */
const CONTRAST_OFFSET = 2;
const MAX_CONTRASTS = 3;

function stepToQueueOffset(_stepUnit: string, remainingCards: number, countSpacing = DEFAULT_RELEARNING_OFFSET): number {
  return Math.max(2, Math.min(countSpacing, Math.max(2, remainingCards)));
}

export type AnswerState = "idle" | "correct" | "wrong" | "revealed";
/**
 * - `idle`: never started
 * - `loading`: start() or startPractice() in progress
 * - `active`: the queue has at least one item
 * - `empty`: the queue came back empty (show SessionEmpty; see `emptyReason`)
 */
export type SessionStatus = "idle" | "loading" | "active" | "empty";
/** Why a planner queue is empty. `seenAll`: nothing is due and every entity here already has a row. */
export type EmptyReason = "seenAll";
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

/**
 * One session slot: the item shown and the concept that its answer grades.
 * `conceptId` always equals `concept.conceptId`.
 */
export interface SessionPair<TItem> {
  item: TItem;
  conceptId: string;
  concept: ConceptProgressRow;
}

/**
 * Builds session slots from planned concepts. A concept whose item cannot be
 * resolved is dropped together with its slot, so items and concepts can never
 * shift against each other.
 */
export function buildPairs<TItem>(
  planned: readonly (ConceptProgressRow | null | undefined)[],
  lookup: (concept: ConceptProgressRow) => TItem | undefined,
): SessionPair<TItem>[] {
  const pairs: SessionPair<TItem>[] = [];
  for (const concept of planned) {
    if (!concept) continue;
    const item = lookup(concept);
    if (item === undefined) continue;
    pairs.push({ item, conceptId: concept.conceptId, concept });
  }
  return pairs;
}

/** `queue` and `conceptQueue` are always derived from `pairs`, never built on their own. */
function fromPairs<TItem>(pairs: SessionPair<TItem>[]) {
  return {
    pairs,
    queue: pairs.map((p) => p.item),
    conceptQueue: pairs.map((p) => p.concept),
  };
}

export interface SessionState<TItem = Country> {
  /** Source of truth for the session order. `queue` and `conceptQueue` mirror it. */
  pairs: SessionPair<TItem>[];
  queue: TItem[];
  conceptQueue: (ConceptProgressRow | null)[];
  index: number;
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  /** Correct answers on a card's first slot (retry slots never count). */
  firstTryCorrect: number;
  /** Distinct cards in the session, the denominator of first-try accuracy. */
  cardCount: number;
  /** Set when the session ends: cards forgotten 4+ times (fsrs_lapses). */
  trickyItems: MissedItem[];
  /** Set when the session ends: session cards now mastered (Review, stability 21+ days). */
  masteredNow: number;
  missedItems: MissedItem[];
  answerState: AnswerState;
  /** What the learner picked or typed for the current answer (null: nothing identifiable). */
  chosen: string | null;
  /** How long the current miss stays on screen (longer after a fast, confident miss). */
  missDelayMs: number;
  startedAt: number;
  endedAt: number | null;
  loading: boolean;
  status: SessionStatus;
  /** Set when `status` is `empty`. */
  emptyReason: EmptyReason | null;
  /** The filtered pool has at least one already-seen concept, so startPractice() has work. */
  hasSeen: boolean;
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
  /**
   * "Practice anyway": an early-review queue of already-seen concepts from the
   * last planner start's filters, lowest retrievability first.
   */
  startPractice(): Promise<void>;
  /** `softCorrect`: accepted only through the fuzzy matcher (typo), graded Hard. */
  /** `chosen`: the picked/typed label, shown as "You chose X" after a miss. Not graded. */
  submit(
    isCorrect: boolean,
    opts?: {
      retrievalMode?: "easy" | "hard";
      softCorrect?: boolean;
      chosen?: string;
      /** Id of the picked entity (map click or option). A miss on another real entity queues a contrast question about it. */
      chosenId?: string;
    },
  ): void;
  reveal(): void;
  /** `allowIdle`: advance past an unanswered question (the "no capital, Skip" path). */
  next(opts?: { allowIdle?: boolean }): void;
}

export interface CreateOpts<TItem = Country> {
  mode: GameMode;
  skill: Skill;
  questions?: number;
  domain?: string;
  dataset?: readonly TItem[];
  getId?: (item: TItem) => string;
  /** subModes a `subMode: "mixed"` session interleaves (e.g. both capital directions). */
  mixedSubModes?: readonly string[];
  /**
   * Which subMode to seed for an entity in a mixed session, from its saved rows
   * by subMode; null seeds nothing for it. Default: a random one with no row.
   */
  mixedPick?: (rows: ReadonlyMap<string, ConceptProgressRow>) => string | null;
}

/** Days of recognition stability before an entity is also asked as recall. */
export const RECALL_AFTER_DAYS = 7;

/**
 * Recognition first, then recall (generation effect): a new entity starts as
 * choosing among options ("name"); once that card is stable for a week, it is
 * also asked typed ("nameType"). In between, nothing is seeded: the planner
 * brings the recognition card back when it is due.
 */
export function recognitionThenRecall(rows: ReadonlyMap<string, ConceptProgressRow>): string | null {
  const recognition = rows.get("name");
  if (!recognition) return "name";
  if (rows.has("nameType")) return null;
  const stable =
    normalizeState(recognition.fsrs_state) === State.Review &&
    (recognition.fsrs_stability ?? 0) >= RECALL_AFTER_DAYS;
  return stable ? "nameType" : null;
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
  mixedSubModes,
  mixedPick,
}: CreateOpts<TItem>): UseBoundStore<StoreApi<SessionState<TItem>>> {
  const activeDataset = (dataset ?? COUNTRIES) as unknown as readonly TItem[];
  const resolveId = getId ?? ((item: TItem) => {
    const raw = item as unknown as SessionItemLike;
    return raw.id ?? raw.iso3 ?? raw.name;
  });

  const itemMap = new Map<string, TItem>();
  for (const item of activeDataset) {
    const raw = item as unknown as SessionItemLike;
    itemMap.set(resolveId(item), item);
    if (raw.iso3) itemMap.set(raw.iso3, item);
  }
  const lookupItem = (c: ConceptProgressRow): TItem | undefined =>
    itemMap.get(parseConceptId(c.conceptId).entityId) ?? itemMap.get(c.iso3);

  /** Same keys `lookupItem` resolves by, applied to one item. */
  const conceptMatchesItem = (c: ConceptProgressRow, item: TItem): boolean => {
    const raw = item as unknown as SessionItemLike;
    const keys = new Set([resolveId(item), raw.iso3].filter(Boolean));
    return keys.has(parseConceptId(c.conceptId).entityId) || keys.has(c.iso3);
  };
  const defaultSubModes: Partial<Record<Skill, string>> = {
    capital: "countryToCap",
    flag: "flagToCountry",
    name: "name",
    location: "find",
  };
  const defaultSubMode = defaultSubModes[skill] ?? "";

  /** A never-reviewed row for an entity; nothing is persisted until it is graded. */
  const newConceptRow = (conceptId: string, item: TItem): ConceptProgressRow => {
    const raw = item as unknown as SessionItemLike;
    return {
      conceptId,
      iso3: raw.iso3 ?? resolveId(item),
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
  };

  type PlannerOpts = { continent?: string; subMode?: string };
  /** Filters of the last planner start(), reused by startPractice(). */
  let lastPlannerOpts: PlannerOpts = {};

  const inContinent = (item: TItem, continent: string | undefined) =>
    !continent ||
    continent === "All" ||
    (item as unknown as SessionItemLike).continent === continent;

  /** Persisted rows of this store's domain, continent, subMode and dataset. */
  const filterPool = (
    allConcepts: ConceptProgressRow[],
    opts: PlannerOpts,
  ): ConceptProgressRow[] => {
    let pool = allConcepts;

    // Filter pool by domain if specified
    if (domain && domain !== "world") {
      pool = pool.filter((c) => c.conceptId.startsWith(`${domain}:`));
    } else if (domain === "world") {
      // World domain: either legacy (no domain prefix) or explicitly world:
      pool = pool.filter((c) => !c.conceptId.includes(":") || !c.conceptId.startsWith("spain:"));
    }

    if (opts.continent && opts.continent !== "All") {
      const validIds = new Set(
        activeDataset.filter((c) => inContinent(c, opts.continent)).map((c) => resolveId(c)),
      );
      pool = pool.filter((c) => {
        const parsed = parseConceptId(c.conceptId);
        return validIds.has(parsed.entityId) || validIds.has(c.iso3);
      });
    }

    if (opts.subMode && opts.subMode !== "mixed") {
      pool = pool.filter((c) => c.conceptId.endsWith(`:${opts.subMode}`));
    } else if (opts.subMode === "mixed" && mixedSubModes) {
      pool = pool.filter((c) => mixedSubModes.includes(parseConceptId(c.conceptId).subMode ?? ""));
    }

    // Keep only concepts of the active dataset. Domain and subMode alone are
    // not enough: Spain CCAA and provinces share both.
    return pool.filter((c) => lookupItem(c) !== undefined);
  };

  // Easy entities are introduced first; Array.sort is stable, so ties keep dataset order.
  const difficultyRank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
  const seedOrder = [...activeDataset].sort(
    (a, b) =>
      (difficultyRank[(a as { difficulty?: string }).difficulty ?? ""] ?? 3) -
      (difficultyRank[(b as { difficulty?: string }).difficulty ?? ""] ?? 3),
  );

  /**
   * In-memory New concepts for dataset entities with no row in `pool`, easy
   * before hard (`seedOrder`), respecting the continent filter. Nothing is persisted
   * until the concept is graded.
   */
  const newSeeds = (
    pool: ConceptProgressRow[],
    opts: PlannerOpts,
    limit: number,
  ): ConceptProgressRow[] => {
    const seeds: ConceptProgressRow[] = [];
    if (limit <= 0) return seeds;
    // Mixed: an entity is new per direction, so a learned country→capital still seeds capital→country.
    const mixed = opts.subMode === "mixed" && mixedSubModes ? mixedSubModes : null;
    const key = (entityId: string, sm: string) => (mixed ? `${entityId}:${sm}` : entityId);
    const used = new Set(
      pool.map((c) => {
        const p = parseConceptId(c.conceptId);
        return key(p.entityId, p.subMode ?? "");
      }),
    );
    // Saved rows per entity and subMode, for a pick rule.
    const rowsByEntity = new Map<string, Map<string, ConceptProgressRow>>();
    if (mixed && mixedPick) {
      for (const c of pool) {
        const p = parseConceptId(c.conceptId);
        const m = rowsByEntity.get(p.entityId) ?? new Map<string, ConceptProgressRow>();
        m.set(p.subMode ?? "", c);
        rowsByEntity.set(p.entityId, m);
      }
    }
    for (const c of seedOrder) {
      if (seeds.length >= limit) break;
      if (!inContinent(c, opts.continent)) continue;
      const entityId = resolveId(c);
      let sm = seedSubMode(opts);
      if (mixed) {
        const free = mixed.filter((m) => !used.has(key(entityId, m)));
        if (free.length === 0) continue;
        if (mixedPick) {
          const pick = mixedPick(rowsByEntity.get(entityId) ?? new Map());
          if (!pick || !free.includes(pick)) continue;
          sm = pick;
        } else {
          sm = free[Math.floor(Math.random() * free.length)]!;
        }
        // One slot per entity per session: mark every direction as taken.
        for (const m of mixed) used.add(key(entityId, m));
      } else if (used.has(entityId)) continue;
      const raw = c as unknown as SessionItemLike;
      seeds.push({
        conceptId: formatConceptId({
          domain: domain as any,
          entityId,
          skill,
          subMode: sm || "default",
        }),
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
      });
      used.add(entityId);
    }
    return seeds;
  };

  /** For mixed mode, default to a standard subMode, else use the provided one. */
  const seedSubMode = (opts: PlannerOpts) =>
    opts.subMode && opts.subMode !== "mixed" ? opts.subMode : defaultSubMode;

  const isSeen = (c: ConceptProgressRow) => normalizeState(c.fsrs_state) !== State.New;

  const safeRetrievability = (c: ConceptProgressRow, nowMs: number): number => {
    try {
      return getRetrievability(c, nowMs);
    } catch {
      return 0;
    }
  };

  /** Fresh-session fields, set when a start begins. */
  const loadingState = (): Partial<SessionState<TItem>> => ({
    loading: true,
    status: "loading",
    emptyReason: null,
    hasSeen: false,
    ...fromPairs<TItem>([]),
    index: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    firstTryCorrect: 0,
    cardCount: 0,
    trickyItems: [],
    masteredNow: 0,
    missedItems: [],
    answerState: "idle",
    startedAt: 0,
    endedAt: null,
    questionStartedAt: 0,
    fsrsUpdatedIds: new Set(),
    inSessionRetries: new Map(),
  });

  /** Fields set when a start has built its pairs. */
  const readyState = (
    pairs: SessionPair<TItem>[],
    info: { hasSeen?: boolean } = {},
  ): Partial<SessionState<TItem>> => {
    const now = Date.now();
    return {
      ...fromPairs(pairs),
      cardCount: new Set(pairs.map((p) => p.conceptId)).size,
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
      status: pairs.length === 0 ? "empty" : "active",
      emptyReason: pairs.length === 0 ? "seenAll" : null,
      hasSeen: info.hasSeen ?? false,
      questionStartedAt: now,
      fsrsUpdatedIds: new Set(),
      inSessionRetries: new Map(),
    };
  };

  let mismatchLogged = false;
  /**
   * Every persisted row of this skill, loaded by the last start. Null when the
   * session was built from someone else's rows (Due Today): then a contrast
   * question could overwrite real progress, so none is added.
   */
  let knownRows: Map<string, ConceptProgressRow> | null = null;
  let contrastsThisSession = 0;
  /** Bumped by every start(); a start that is no longer the latest must not touch the store. */
  let startGen = 0;

  return create<SessionState<TItem>>((set, get) => ({
    pairs: [],
    queue: [],
    conceptQueue: [],
    index: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    firstTryCorrect: 0,
    cardCount: 0,
    trickyItems: [],
    masteredNow: 0,
    missedItems: [],
    answerState: "idle",
    chosen: null,
    missDelayMs: 2500,
    startedAt: 0,
    endedAt: null,
    loading: false,
    status: "idle",
    emptyReason: null,
    hasSeen: false,
    questionStartedAt: 0,
    fsrsUpdatedIds: new Set(),
    inSessionRetries: new Map(),

    current() {
      const s = get();
      return s.queue[s.index] ?? null;
    },

    async start(opts) {
      const gen = ++startGen;
      set(loadingState());
      knownRows = null;
      contrastsThisSession = 0;

      let pairs: SessionPair<TItem>[] = [];
      let info: { hasSeen?: boolean } = {};

      if (opts?.conceptRows && opts.conceptRows.length > 0) {
        // Due Today / pre-built mode: skip the planner, use the caller's queue directly.
        pairs = buildPairs(opts.conceptRows, lookupItem);
      } else if ((opts?.items && opts.items.length > 0) || (opts?.allCountries && opts.allCountries.length > 0)) {
        // Complete mode: use the pre-built shuffled array directly.
        const source = (opts.items ?? opts.allCountries)!;
        const q = [...source];
        for (let i = q.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q[i], q[j]] = [q[j]!, q[i]!];
        }

        // Populate cq with existing FSRS progress rows from DB, or initialize State.New
        const allDbConcepts = await db().concept_progress.where("skill").equals(skill).toArray();
        if (gen !== startGen) return;
        const dbConceptMap = new Map(allDbConcepts.map((c) => [c.conceptId, c]));
        knownRows = dbConceptMap;

        const sm = opts?.subMode && opts.subMode !== "mixed" ? opts.subMode : defaultSubMode;

        // Each item gets its concept here, so the pair is formed at construction.
        pairs = q.map((item): SessionPair<TItem> => {
          const raw = item as unknown as SessionItemLike;
          const entityId = resolveId(item);
          const conceptId = formatConceptId({
            domain: domain as any,
            entityId,
            skill,
            subMode: sm || "default",
          });
          const existing = dbConceptMap.get(conceptId);
          if (existing) return { item, conceptId, concept: existing };
          const concept: ConceptProgressRow = {
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
          return { item, conceptId, concept };
        });

      } else {
        // FSRS session planner: due and learning rows first, then new concepts.
        // How many new ones follows the learner's recent success rate (aim ~85%).
        const plannerOpts: PlannerOpts = { continent: opts?.continent, subMode: opts?.subMode };
        lastPlannerOpts = plannerOpts;
        const [allConcepts, recent] = await Promise.all([
          db().concept_progress.where("skill").equals(skill).toArray(),
          readRecentFirstTries(),
        ]);
        if (gen !== startGen) return;
        knownRows = new Map(allConcepts.map((c) => [c.conceptId, c]));
        const pool = filterPool(allConcepts, plannerOpts);
        const newLimit = adaptiveNewLimit(recent, questions);

        const planned = generateSessionQueue(pool, undefined, {
          sessionSize: questions,
          maxNewPerSession: newLimit,
        });
        const plannedNew = planned.filter((c) => normalizeState(c.fsrs_state) === State.New).length;
        const room = Math.min(questions - planned.length, newLimit - plannedNew);
        pairs = buildPairs([...planned, ...newSeeds(pool, plannerOpts, room)], lookupItem);
        info = { hasSeen: pool.some(isSeen) };
      }

      set(readyState(pairs, info));
    },

    async startPractice() {
      const gen = ++startGen;
      set(loadingState());
      const allConcepts = await db().concept_progress.where("skill").equals(skill).toArray();
      if (gen !== startGen) return;
      knownRows = new Map(allConcepts.map((c) => [c.conceptId, c]));
      contrastsThisSession = 0;
      const now = Date.now();
      const seen = filterPool(allConcepts, lastPlannerOpts)
        .filter(isSeen)
        // Early review would graduate a Learning/Relearning card without its 1m/10m step.
        .filter((c) => {
          const st = normalizeState(c.fsrs_state);
          return !((st === State.Learning || st === State.Relearning) && c.fsrs_due > now);
        })
        .map((c) => ({ c, r: safeRetrievability(c, now) }))
        .sort((a, b) => a.r - b.r || a.c.fsrs_due - b.c.fsrs_due)
        .slice(0, questions)
        .map((x) => x.c);
      const pairs = buildPairs(seen, lookupItem);
      set(readyState(pairs, { hasSeen: pairs.length > 0 }));
    },

    submit(isCorrect, submitOpts) {
      const s = get();
      if (s.answerState !== "idle") return;
      playAnswerSound(isCorrect, s.combo);
      const pair = s.pairs[s.index];
      if (!pair) return;
      const target = pair.item;
      const targetConcept = pair.concept;

      // Never write a grade to a concept other than the one shown.
      const matches = conceptMatchesItem(targetConcept, target);
      const gradeable = matches;
      if (!matches) {
        const msg = `Session pair mismatch: item ${resolveId(target)} vs concept ${targetConcept.conceptId}`;
        if (import.meta.env.DEV) throw new Error(msg);
        if (!mismatchLogged) {
          mismatchLogged = true;
          console.error(`${msg}. Skipping FSRS grade.`);
        }
      }

      const responseMs = Math.max(0, Date.now() - (s.questionStartedAt || Date.now()));

      // ── Accumulate all state updates into one set() call ──────────────────
      const updates: Partial<SessionState<TItem>> = {};

      // 1. Score & UI state
      updates.chosen = submitOpts?.chosen ?? null;
      if (isCorrect) {
        const combo = s.combo + 1;
        updates.score = s.score + 100 + Math.min(s.combo, 9) * 20;
        updates.combo = combo;
        updates.bestCombo = Math.max(s.bestCombo, combo);
        updates.correct = s.correct + 1;
        updates.answerState = "correct";
        // A concept only gets retry slots after a miss, so no retry entry means its first slot.
        if (!s.inSessionRetries.has(targetConcept.conceptId)) {
          updates.firstTryCorrect = s.firstTryCorrect + 1;
        }
      } else {
        updates.combo = 0;
        updates.wrong = s.wrong + 1;
        updates.answerState = "wrong";
        // Only a real pick can be a confident error; a skip or empty Enter is "I don't know".
        updates.missDelayMs = submitOpts?.chosen
          ? missFeedbackMs(responseMs, targetConcept?.skill ?? skill, submitOpts.retrievalMode)
          : 2500;

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

      if (gradeable && effectiveConcept && !s.fsrsUpdatedIds.has(effectiveConcept.conceptId)) {
        const now = Date.now();

        // Use the concept's own skill (critical for Due Today mixed sessions)
        const conceptSkill = effectiveConcept.skill ?? skill;
        const parts = effectiveConcept.conceptId.split(":");
        const actualDirection = parts.length >= 3 ? parts[parts.length - 1]! : `${conceptSkill}->answer`;

        const assessment = assess({
          validationResult: { correct: isCorrect, softCorrect: submitOpts?.softCorrect === true },
          responseMs,
          attemptNumber: 1,
          hintsUsed: 0,
          questionType: conceptSkill,
          retrievalMode: submitOpts?.retrievalMode ?? "easy",
          direction: actualDirection,
        });

        try {
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

          // Optimistic row update at the current index position
          const basePairs = [...s.pairs];
          basePairs[s.index] = { ...pair, concept: updatedProgressRow };
          Object.assign(updates, fromPairs(basePairs));

        } catch (err) {
          // A bad row must not freeze the session: log it and let the UI advance.
          console.error("FSRS processing failed; answer not graded", err);
        }

        // Mark this concept as FSRS-updated for this session
        const nextFsrsUpdatedIds = new Set(s.fsrsUpdatedIds);
        nextFsrsUpdatedIds.add(effectiveConcept.conceptId);
        updates.fsrsUpdatedIds = nextFsrsUpdatedIds;
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
      //    - If there are fewer than 3 cards left, append the retry at the end
      //      so a miss near the end of a session still gets its second try.
      if (!isCorrect && targetConcept) {
        const conceptId = targetConcept.conceptId;
        const retries = s.inSessionRetries.get(conceptId) ?? 0;
        const relearningSteps = getFsrsParameters().relearning_steps;
        const maxRetries = relearningSteps.length;

        const remainingAfterCurrent = s.queue.length - s.index - 1;

        if (retries < maxRetries) {
          // Use the step corresponding to this retry attempt
          const stepUnit = relearningSteps[retries] ?? relearningSteps[relearningSteps.length - 1]!;
          const offset = stepToQueueOffset(String(stepUnit), remainingAfterCurrent);

          // Clamp to the end of the queue (splice inserts before that index)
          const insertAt =
            remainingAfterCurrent >= 3 ? Math.min(s.index + 1 + offset, s.queue.length) : s.queue.length;

          // Re-insert the failed slot (item and its possibly updated concept together)
          const newPairs = [...(updates.pairs ?? s.pairs)];
          newPairs.splice(insertAt, 0, newPairs[s.index]!);
          Object.assign(updates, fromPairs(newPairs));

          // Record the retry count
          const nextRetries = new Map(s.inSessionRetries);
          nextRetries.set(conceptId, retries + 1);
          updates.inSessionRetries = nextRetries;
        }
      }

      // 4. Contrast question: a pick of another real entity is a confusion
      //    (Niger for Nigeria). Asking about the picked one shortly after trains
      //    the difference itself, not only the right answer.
      if (!isCorrect && submitOpts?.chosenId && knownRows && contrastsThisSession < MAX_CONTRASTS) {
        const chosenItem = itemMap.get(submitOpts.chosenId);
        const parsed = parseConceptId(targetConcept.conceptId);
        if (chosenItem && chosenItem !== target && parsed.skill === skill) {
          const chosenEntity = resolveId(chosenItem);
          const contrastId = formatConceptId({
            domain: parsed.domain as GeoDomain,
            entityId: chosenEntity,
            skill,
            subMode: parsed.subMode,
          });
          const base = updates.pairs ?? s.pairs;
          const comingUp = base.slice(s.index + 1).some((p) => p.conceptId === contrastId);
          if (!comingUp) {
            // Latest copy first: this session may already have graded it.
            const seenHere = [...base].reverse().find((p) => p.conceptId === contrastId)?.concept;
            const concept = seenHere ?? knownRows.get(contrastId) ?? newConceptRow(contrastId, chosenItem);
            const newPairs = [...base];
            newPairs.splice(Math.min(s.index + 1 + CONTRAST_OFFSET, newPairs.length), 0, {
              item: chosenItem,
              conceptId: contrastId,
              concept,
            });
            Object.assign(updates, fromPairs(newPairs));
            if (!seenHere) updates.cardCount = (updates.cardCount ?? s.cardCount) + 1;
            contrastsThisSession++;
          }
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

    next(nextOpts) {
      const s = get();
      // A late auto-advance timer or double click must not skip an unanswered question.
      if (s.endedAt !== null || (s.answerState === "idle" && !nextOpts?.allowIdle)) return;
      const nextIndex = s.index + 1;
      if (nextIndex >= s.queue.length) {
        const endedAt = Date.now();
        // Latest row per card: retry slots carry the graded copy.
        const cards = new Map(s.pairs.map((p) => [p.conceptId, p]));
        const trickyItems: MissedItem[] = [...cards.values()]
          .filter((p) => (p.concept.fsrs_lapses ?? 0) >= 4)
          .map((p) => {
            const raw = p.item as unknown as SessionItemLike;
            return { id: p.conceptId, prompt: raw.name, answer: "", flagIso2: raw.flagCode ?? raw.iso2 };
          });
        const masteredNow = [...cards.values()].filter((p) => isMastered(p.concept)).length;
        set({ endedAt, answerState: "idle", combo: 0, trickyItems, masteredNow });
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
        chosen: null,
        questionStartedAt: Date.now(),
      });
    },
  }));
}
