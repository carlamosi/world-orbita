import { lazy, Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COUNTRIES, pickRandomCountries } from "@/lib/countries";
import type { Country } from "@/types/country";
import { createSessionStore } from "@/features/engine/useSession";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { useAnswerHotkeys } from "@/hooks/useAnswerHotkeys";
import { SessionEnd } from "@/features/engine/SessionEnd";
import { PromptPill } from "@/features/engine/PromptPill";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { HardInput } from "@/features/engine/HardInput";
import { FlagImage } from "@/components/ui/FlagImage";
import { db, type ConceptProgressRow, ALL_SKILLS } from "@/lib/db/orbita-db";
import { generateDueTodayQueue } from "@/lib/fsrs/planner";
import { spring, fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Lazy-load the globe — only needed when a 'location' card appears
const Globe3D = lazy(() => import("@/features/globe/Globe3D"));

function GlobeFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="size-12 rounded-full border-2 border-white/10 border-t-[color:var(--cyan)] animate-spin" />
    </div>
  );
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/* The session store: mixed-skill Due Today session.
   skill="flag" is a placeholder — FSRS updates always use targetConcept.skill. */
const useReviewSession = createSessionStore({ mode: "find", skill: "flag", questions: 9999 });

const SKILL_LABELS: Record<string, string> = {
  flag: "Flag",
  capital: "Capital",
  location: "Location",
  name: "Name",
};

const SKILL_COLORS: Record<string, string> = {
  flag: "text-[color:var(--neon)] border-[color:var(--neon)]/30 bg-[color:var(--neon)]/8",
  capital: "text-[color:var(--coral)] border-[color:var(--coral)]/30 bg-[color:var(--coral)]/8",
  location: "text-[color:var(--violet)] border-[color:var(--violet)]/30 bg-[color:var(--violet)]/8",
  name: "text-[color:var(--cyan)] border-[color:var(--cyan)]/30 bg-[color:var(--cyan)]/8",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Globe-based location question — same UX as LocatePage "Find" mode.
 * The learner must click the correct country on the 3D globe.
 */
function LocationQuestion({
  current,
  answerState,
  onSubmit,
}: {
  current: Country;
  answerState: "idle" | "correct" | "wrong" | "revealed";
  onSubmit: (iso3: string) => void;
}) {
  return (
    <div className="absolute inset-0">
      <Suspense fallback={<GlobeFallback />}>
        <Globe3D
          countries={COUNTRIES}
          highlightIso3={answerState === "correct" ? current.iso3 : null}
          revealIso3={
            answerState === "wrong" || answerState === "revealed" ? current.iso3 : null
          }
          onCountryClick={
            answerState === "idle" ? onSubmit : undefined
          }
          disableHoverLabel={answerState === "idle"}
          questionKey={current.iso3}
          pointOfView={undefined}
          activeContinent={null}
        />
      </Suspense>
    </div>
  );
}

/**
 * Multiple-choice question card for flag / capital / name skills.
 */
function McQuestion({
  options,
  current,
  skill,
  answerState,
  selectedIso3,
  onSelect,
}: {
  options: Country[];
  current: Country;
  skill: string;
  answerState: "idle" | "correct" | "wrong" | "revealed";
  selectedIso3: string | null;
  onSelect: (iso3: string) => void;
}) {
  const revealed = answerState !== "idle";
  return (
    <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {options.map((opt: Country, idx: number) => {
        const label = skill === "capital" ? (opt.capital ?? opt.name) : opt.name;
        const isCorrectOption = opt.iso3 === current.iso3;
        const isChosen = selectedIso3 === opt.iso3;

        const showGreen = revealed && isCorrectOption;
        const showRed = revealed && isChosen && !isCorrectOption;

        return (
          <motion.button
            key={opt.iso3}
            whileHover={!revealed ? { scale: 1.02 } : {}}
            whileTap={!revealed ? { scale: 0.98 } : {}}
            disabled={revealed}
            onClick={() => onSelect(opt.iso3)}
            className={cn(
              "glass rounded-2xl p-4 text-left font-display font-medium text-base transition-all flex items-center justify-between border",
              !revealed && "text-white/90 hover:bg-white/10 hover:border-white/20 active:bg-white/15",
              showGreen &&
                "border-[color:var(--neon)] bg-[color:var(--neon)]/15 text-white shadow-[0_0_20px_rgba(0,255,180,0.2)]",
              showRed && "border-red-500 bg-red-500/15 text-red-300",
              revealed && !showGreen && !showRed && "opacity-40 text-white/50",
            )}
          >
            <span className="truncate">{label}</span>
            <span className="font-mono text-xs text-white/30 ml-2">[{idx + 1}]</span>
          </motion.button>
        );
      })}
    </div>
  );
}

import { ContinentSelect, useContinentPref } from "@/features/engine/ContinentSelect";

// ─── Main component ───────────────────────────────────────────────────────────

const BLOCK_SIZE = 10;

export default function ReviewPage() {
  const s = useReviewSession();
  const [loadState, setLoadState] = useState<"loading" | "empty" | "ready">("loading");
  const [dueRows, setDueRows] = useState<ConceptProgressRow[]>([]);
  const [blockOffset, setBlockOffset] = useState<number>(0);
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);
  const [continent, setContinent] = useContinentPref();

  const current = s.queue[s.index] ?? null;
  const currentConcept = s.conceptQueue[s.index] ?? null;
  const finished = s.endedAt !== null;

  const loadQueue = useCallback(async () => {
    setLoadState("loading");
    const allRows: ConceptProgressRow[] = [];
    for (const skill of ALL_SKILLS) {
      const rows = await db().concept_progress.where("skill").equals(skill).toArray();
      allRows.push(...rows);
    }

    const filteredRows = continent === "All" 
      ? allRows 
      : allRows.filter((r) => {
          const iso3 = r.conceptId.split(":")[0];
          const country = COUNTRIES.find((c) => c.iso3 === iso3);
          return country?.continent === continent;
        });

    const queue = generateDueTodayQueue(filteredRows);
    setDueRows(queue);
    setBlockOffset(0);

    if (queue.length === 0) {
      setLoadState("empty");
    } else {
      setLoadState("ready");
      const currentBatch = queue.slice(0, BLOCK_SIZE);
      await s.start({ conceptRows: currentBatch });
    }
  }, [s, continent]);

  const loadNextBatch = useCallback(async () => {
    const nextOffset = blockOffset + BLOCK_SIZE;
    setBlockOffset(nextOffset);
    const nextBatch = dueRows.slice(nextOffset, nextOffset + BLOCK_SIZE);
    if (nextBatch.length > 0) {
      await s.start({ conceptRows: nextBatch });
    } else {
      await loadQueue();
    }
  }, [blockOffset, dueRows, loadQueue, s]);

  const hasNextBlock = blockOffset + BLOCK_SIZE < dueRows.length;

  // Load all due cards on mount or when continent changes
  useEffect(() => {
    let cancelled = false;
    void loadQueue();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continent]);

  const restart = useCallback(async () => {
    await loadQueue();
  }, [loadQueue]);

  useAutoAdvance({ answerState: s.answerState, finished, next: s.next });

  const onSkip = useCallback(() => {
    if (!finished && current && s.answerState === "idle") s.reveal();
  }, [finished, current, s]);
  useSkipHotkey(onSkip);

  // Clear selection on every new card
  useEffect(() => {
    setSelectedIso3(null);
  }, [s.index]);

  const rawSkill = (currentConcept?.skill ?? "flag") as string;
  let skill = rawSkill;
  let subMode = "";
  if (currentConcept && currentConcept.conceptId) {
    const parts = currentConcept.conceptId.split(":");
    if (parts.length >= 3) {
       skill = parts[1] as string;
       subMode = parts[2] as string;
    }
  }

  const skillLabel = SKILL_LABELS[skill] ?? skill;
  const skillColor = SKILL_COLORS[skill] ?? SKILL_COLORS.flag!;
  const isLocationSkill = skill === "location" || subMode === "find" || subMode === "locator";

  // Generate 4 MC options (continent-scoped) — used for flag / capital / name
  const mcOptions: Country[] = useMemo(() => {
    if (!current || isLocationSkill) return [];
    const distractors = pickRandomCountries(3, new Set([current.iso3]), current.continent);
    return shuffleArray([current, ...distractors]);
  }, [current, isLocationSkill]);

  // Keyboard shortcuts for MC skills
  const hotkeyItems = useMemo(
    () => (s.answerState === "idle" && !isLocationSkill ? mcOptions.map((o) => ({ id: o.iso3 })) : []),
    [mcOptions, s.answerState, isLocationSkill],
  );
  const onHotkey = useCallback(
    (id: string) => {
      if (!current || s.answerState !== "idle") return;
      setSelectedIso3(id);
      s.submit(id === current.iso3);
    },
    [current, s],
  );
  useAnswerHotkeys(hotkeyItems, onHotkey);

  // Prompt and supplementary info per skill
  const questionMeta = useMemo(() => {
    if (!current) return null;
    switch (skill) {
      case "flag":
        return {
          prompt: "Which country owns this flag?",
          visual: (
            <FlagImage
              iso2={current.iso2}
              alt="Mystery flag"
              size={640}
              className="w-full max-w-[420px] h-auto aspect-[3/2] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden mx-auto"
            />
          ),
          subtitle: `Capital: ${current.capital ?? "—"}`,
        };
      case "capital":
        if (subMode === "capToCountry") {
          return {
            prompt: `Which country's capital is ${current.capital}?`,
            visual: (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="font-display text-5xl md:text-6xl font-bold text-[color:var(--cyan)] tracking-tight text-center">
                  {current.capital}
                </div>
              </div>
            ),
            subtitle: `Capital of ${current.name}`,
          };
        }
        return {
          prompt: `What's the capital of ${current.name}?`,
          visual: (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="font-display text-5xl md:text-6xl font-bold text-white/90 tracking-tight text-center">
                {current.name}
              </div>
              <div className="font-mono text-xs uppercase tracking-widest text-white/30">
                {current.continent}
              </div>
            </div>
          ),
          subtitle: `Capital of ${current.name}`,
        };
      case "location":
        return {
          prompt: "", // rendered as PromptPill overlay on the globe
          visual: null,
          subtitle: current.continent,
        };
      case "name":
      default:
        return {
          prompt: "Which country does this flag belong to?",
          visual: (
            <FlagImage
              iso2={current.iso2}
              alt="Mystery flag"
              size={640}
              className="w-full max-w-[420px] h-auto aspect-[3/2] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden mx-auto"
            />
          ),
          subtitle: `Capital: ${current.capital ?? "—"}`,
        };
    }
  }, [current, skill, subMode]);

  // ── Globe submit handler (location skill) ──────────────────────────────────
  const handleGlobeClick = useCallback(
    (iso3: string) => {
      if (!current || s.answerState !== "idle") return;
      setSelectedIso3(iso3);
      s.submit(iso3 === current.iso3);
    },
    [current, s],
  );

  /* ─── Loading ─── */
  if (loadState === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="size-12 rounded-full border-2 border-white/10 border-t-[color:var(--cyan)] animate-spin" />
          <p className="font-mono text-xs uppercase tracking-widest text-white/40">Loading due cards…</p>
        </motion.div>
      </div>
    );
  }

  /* ─── Empty state ─── */
  if (loadState === "empty") {
    return (
      <div className="relative min-h-dvh pt-24 pb-12 flex flex-col items-center justify-center px-4">
        <div className="absolute top-24 z-20 flex justify-center w-full">
          <ContinentSelect value={continent} onChange={setContinent} />
        </div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-6 text-center max-w-sm"
        >
          <div className="relative size-20">
            <div className="absolute inset-0 rounded-full bg-[color:var(--neon)]/20 animate-ping" style={{ animationDuration: "2.4s" }} />
            <div className="relative size-full rounded-full bg-gradient-to-br from-[color:var(--neon)]/30 to-[color:var(--cyan)]/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="size-8 text-[color:var(--neon)]">
                <path
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div>
            <h1 className="font-display text-3xl font-semibold text-white tracking-tight">
              All clear!
            </h1>
            <p className="mt-2 text-white/50 text-sm leading-relaxed">
              No cards are due right now. Your memory is in great shape — come back later when cards need refreshing.
            </p>
          </div>

          <div className="glass rounded-2xl p-4 w-full text-left">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/35 mb-2">What to do instead</p>
            <ul className="space-y-1.5 text-sm text-white/60">
              <li>→ Practice <span className="text-white">Flags</span> to learn new countries</li>
              <li>→ Try <span className="text-white">Speed Round</span> for reflexes</li>
              <li>→ Browse the <span className="text-white">Explorer</span> atlas</li>
            </ul>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ─── Session End ─── */
  if (finished) {
    return (
      <div className="relative min-h-dvh pt-20 flex flex-col items-center">
        <SessionEnd
          show
          score={s.score}
          correct={s.correct}
          total={s.queue.length}
          wrong={s.wrong}
          masteredCount={s.masteredCount}
          missedItems={s.missedItems}
          hasNextBlock={hasNextBlock}
          onNextBlock={loadNextBatch}
        />
      </div>
    );
  }

  /* ─── Active session — LOCATION skill: full-screen globe (identical to LocatePage Find) ─── */
  if (isLocationSkill && current) {
    return (
      <div className="relative min-h-dvh pt-20">
        {/* Globe fills the screen */}
        <LocationQuestion
          current={current}
          answerState={s.answerState as "idle" | "correct" | "wrong" | "revealed"}
          onSubmit={handleGlobeClick}
        />

        {/* Skill badge */}
        <div className="absolute top-24 left-4 md:left-6 z-20">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest border",
            skillColor,
          )}>
            {skillLabel}
          </span>
        </div>

        {/* Continent Filter */}
        <div className="absolute top-24 inset-x-0 z-20 flex justify-center pointer-events-auto">
          <ContinentSelect value={continent} onChange={setContinent} />
        </div>

        {/* Progress counter */}
        <div className="absolute top-24 right-4 md:right-6 z-20 hidden sm:block">
          <span className="glass px-3 py-1 rounded-full font-mono text-xs text-white/50">
            {s.index + 1} / {s.queue.length}
          </span>
        </div>

        {/* Prompt pill overlay */}
        <div className="absolute top-36 md:top-32 inset-x-0 z-20 flex justify-center pointer-events-none">
          <PromptPill
            keyId={`review-loc-${s.index}-${current.iso3}`}
            index={s.index}
            total={s.queue.length}
            title={
              <>Find <span className="text-glow-cyan">{current.name}</span> on the map</>
            }
          />
        </div>

        {/* Feedback bar */}
        <div className="fixed bottom-0 inset-x-0 pb-6 px-4 md:px-6 z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <FeedbackBar
              show={s.answerState !== "idle"}
              state={s.answerState as "correct" | "wrong" | "revealed"}
              title={current.name}
              subtitle={current.continent}
              onNext={() => s.next()}
              onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
              hideNext
            />
          </div>
        </div>
      </div>
    );
  }

  /* ─── Active session — flag / capital / name: card layout with MC options ─── */
  return (
    <div className="relative min-h-dvh pt-20 flex flex-col items-center">
      <AnimatePresence mode="wait">
        {current && questionMeta && (
          <motion.div
            key={`${s.index}-${current.iso3}`}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
            className="w-full flex flex-col items-center px-4 md:px-6 pb-32 max-w-4xl gap-6"
          >
            {/* Skill badge + progress header */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest border",
                  skillColor,
                )}>
                  {skillLabel}
                </span>
                {s.inSessionRetries.size > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[color:var(--coral)]/15 border border-[color:var(--coral)]/30 text-[color:var(--coral)]">
                    {s.inSessionRetries.size} in relearning
                  </span>
                )}
              </div>
              
              <div className="pointer-events-auto">
                <ContinentSelect value={continent} onChange={setContinent} />
              </div>

              <span className="font-mono text-xs text-white/30 hidden sm:block">
                {s.index + 1} / {s.queue.length}
              </span>
            </div>

            <PromptPill
              keyId={`review-${s.index}-${current.iso3}`}
              index={s.index}
              total={s.queue.length}
              title={questionMeta.prompt}
              isRelearning={Boolean(currentConcept && s.inSessionRetries.has(currentConcept.conceptId))}
            />

            {/* Visual stimulus */}
            {questionMeta.visual && (
              <motion.div
                key={`${s.index}-visual`}
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={spring.soft}
                className="w-full flex justify-center"
              >
                {questionMeta.visual}
              </motion.div>
            )}

            {/* Question input: Hard typing for flagToType / typing modes, MC for choices */}
            {subMode === "flagToType" ? (
              <div className="w-full max-w-md mx-auto">
                <HardInput
                  target={current}
                  matchTarget={current.name}
                  onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                  placeholder="Type the country…"
                />
              </div>
            ) : (
              <McQuestion
                options={mcOptions}
                current={current}
                skill={skill}
                answerState={s.answerState as "idle" | "correct" | "wrong" | "revealed"}
                selectedIso3={selectedIso3}
                onSelect={(iso3) => {
                  if (!current || s.answerState !== "idle") return;
                  setSelectedIso3(iso3);
                  s.submit(iso3 === current.iso3);
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback bar */}
      <div className="fixed bottom-0 inset-x-0 pb-6 px-4 md:px-6 z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <FeedbackBar
            show={s.answerState !== "idle"}
            state={s.answerState as "correct" | "wrong" | "revealed"}
            title={current?.name ?? ""}
            subtitle={questionMeta?.subtitle ?? ""}
            onNext={() => s.next()}
            onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
            hideNext
          />
        </div>
      </div>
    </div>
  );
}
