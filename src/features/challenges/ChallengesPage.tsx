import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Skill } from "@/lib/db/orbita-db";
import { generateDaily, generateWeekly, type ChallengeSet } from "@/lib/challenges";
import { Badge } from "@/components/ui/orbita-badge";
import { Button } from "@/components/ui/orbita-button";
import { FlagImage } from "@/components/ui/FlagImage";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { recordSessionEnd, updateSkillProgress } from "@/lib/db/repo";
import { confidenceAfter } from "@/lib/mastery";
import { dateKey, weekKey } from "@/lib/streak";
import type { Country } from "@/types/country";
import { COUNTRY_BY_ISO3, pickRandomCountries } from "@/lib/countries";
import { useAnswerHotkeys } from "@/hooks/useAnswerHotkeys";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { feedbackContext } from "@/features/engine/feedbackContext";

import { SessionEnd } from "@/features/engine/SessionEnd";
import { Link } from "@tanstack/react-router";
import type { MissedItem } from "@/features/engine/useSession";
import { HardcoreRunner } from "@/features/challenges/HardcoreRunner";
import {
  type HardcoreExamState,
  generateHardcoreExam,
  loadHardcoreProgress,
  clearHardcoreProgress,
} from "@/lib/hardcore";
import { COUNTRIES } from "@/lib/countries";

export type Active = {
  set: ChallengeSet;
  index: number;
  correct: number;
  wrong: number;
  score: number;
  bestCombo: number;
  combo: number;
  startedAt: number;
  answerState: "idle" | "correct" | "wrong";
  /** The picked option's label, for "You chose X" after a miss. */
  chosen?: string;
  missedItems: MissedItem[];
};

const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania"] as const;

export default function ChallengesPage() {
  const [daily, setDaily] = useState<ChallengeSet | null>(null);
  const [weekly, setWeekly] = useState<ChallengeSet | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [activeHardcore, setActiveHardcore] = useState<HardcoreExamState | null>(null);
  const [hardcoreSaved, setHardcoreSaved] = useState<Record<string, HardcoreExamState | null>>({});

  const reloadHardcoreProgress = useCallback(() => {
    CONTINENTS.forEach((c) => {
      loadHardcoreProgress(c).then((p) => {
        setHardcoreSaved((prev) => ({ ...prev, [c]: p }));
      });
    });
  }, []);

  useEffect(() => {
    generateDaily().then(setDaily);
    generateWeekly().then(setWeekly);
    reloadHardcoreProgress();
  }, [reloadHardcoreProgress]);

  const todayKey = dateKey();
  const thisWeekKey = weekKey();
  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const dailyBest = useMemo(
    () =>
      sessions
        .filter((s) => s.mode === "challenge_daily" && s.periodKey === todayKey)
        .reduce((m, s) => Math.max(m, s.score), 0),
    [sessions, todayKey],
  );
  const weeklyBest = useMemo(
    () =>
      sessions
        .filter((s) => s.mode === "challenge_weekly" && s.periodKey === thisWeekKey)
        .reduce((m, s) => Math.max(m, s.score), 0),
    [sessions, thisWeekKey],
  );

  const startHardcoreExam = async (continent: string) => {
    const existing = await loadHardcoreProgress(continent);
    if (existing && !existing.completedAt) {
      setActiveHardcore(existing);
      return;
    }

    const queue = generateHardcoreExam(continent);
    const newState: HardcoreExamState = {
      continent,
      currentIndex: 0,
      totalQuestions: queue.length,
      score: 0,
      correct: 0,
      wrong: 0,
      bestCombo: 0,
      combo: 0,
      queue,
      answers: new Array(queue.length).fill("idle"),
      startedAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
    };
    setActiveHardcore(newState);
  };

  if (activeHardcore) {
    return (
      <HardcoreRunner
        initialState={activeHardcore}
        onExit={() => {
          setActiveHardcore(null);
          reloadHardcoreProgress();
        }}
      />
    );
  }

  if (active) {
    return (
      <ChallengeRunner
        active={active}
        setActive={setActive}
        onExit={() => setActive(null)}
      />
    );
  }

  return (
    <div className="min-h-dvh pt-24 pb-16 px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <Badge tone="violet">Challenges</Badge>
          <h1 className="mt-3 font-display text-4xl text-white tracking-tight text-glow-violet">
            Today's orbit
          </h1>
          <p className="mt-2 text-white/55 text-[15px]">
            Deterministic question sets — everyone gets the same daily run.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-4 mb-16">
          <ChallengeCard
            kind="daily"
            set={daily}
            best={dailyBest}
            onStart={(set) =>
              setActive({
                set,
                index: 0,
                correct: 0,
                wrong: 0,
                score: 0,
                combo: 0,
                bestCombo: 0,
                startedAt: Date.now(),
                answerState: "idle",
                missedItems: [],
              })
            }
          />
          <ChallengeCard
            kind="weekly"
            set={weekly}
            best={weeklyBest}
            onStart={(set) =>
              setActive({
                set,
                index: 0,
                correct: 0,
                wrong: 0,
                score: 0,
                combo: 0,
                bestCombo: 0,
                startedAt: Date.now(),
                answerState: "idle",
                missedItems: [],
              })
            }
          />
        </div>

        {/* Hardcore Mode Section */}
        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="coral">Hardcore Mode</Badge>
                <span className="font-mono text-xs text-white/40 uppercase tracking-widest">
                  Exams
                </span>
              </div>
              <h2 className="mt-2 font-display text-2xl text-white tracking-tight">
                Per-Continent Master Exams
              </h2>
              <p className="mt-1 text-white/55 text-[14px]">
                Full continent coverage across all Hard difficulty variants (Locate, Name, Country ↔ Capital). Resumable anytime.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTINENTS.map((cont) => {
              const contCount = COUNTRIES.filter((c) => c.continent === cont).length;
              const saved = hardcoreSaved[cont];
              const isCompleted = saved?.completedAt != null;
              const inProgress = saved && !isCompleted && saved.currentIndex > 0;

              return (
                <motion.div
                  key={cont}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.soft}
                  className="glass-strong rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl text-white tracking-tight">{cont}</h3>
                      {isCompleted ? (
                        <Badge tone="neon">Completed</Badge>
                      ) : inProgress ? (
                        <Badge tone="cyan">In Progress</Badge>
                      ) : (
                        <Badge tone="muted">Not Started</Badge>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-white/45 uppercase tracking-wider">
                      {contCount} Countries • {saved?.totalQuestions ?? contCount * 4} Questions
                    </p>
                    {inProgress && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] font-mono text-white/60 mb-1">
                          <span>Progress</span>
                          <span>
                            {saved.currentIndex} / {saved.totalQuestions}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[color:var(--cyan)] transition-all"
                            style={{
                              width: `${Math.round((saved.currentIndex / saved.totalQuestions) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant={inProgress ? "primary" : "secondary"}
                      size="sm"
                      className="w-full"
                      onClick={() => startHardcoreExam(cont)}
                    >
                      {isCompleted ? "Retake Exam" : inProgress ? "Resume Exam" : "Start Exam"}
                    </Button>
                    {(inProgress || isCompleted) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Reset progress"
                        onClick={async () => {
                          await clearHardcoreProgress(cont);
                          reloadHardcoreProgress();
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Regional Mastery: Spain Card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.soft}
              className="glass-strong rounded-2xl p-5 flex flex-col justify-between gap-4 border border-[color:var(--neon)]/30 bg-gradient-to-b from-[color:var(--neon)]/5 to-transparent"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl text-white tracking-tight flex items-center gap-2">
                    <span>🇪🇸</span> Spain
                  </h3>
                  <Badge tone="neon">Regional</Badge>
                </div>
                <p className="mt-2 font-mono text-[11px] text-white/45 uppercase tracking-wider">
                  19 CCAA • 50 Provinces • Flags • Capitals
                </p>
                <p className="mt-2 text-[13px] text-white/65">
                  Complete mastery over Spain's administrative geography: locate, identify, flags, and seats of power.
                </p>
              </div>

              <div className="pt-2">
                <Link to="/spain" className="block w-full">
                  <Button variant="primary" size="sm" className="w-full">
                    Learn Spain →
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ChallengeCard({
  kind,
  set,
  best,
  onStart,
}: {
  kind: "daily" | "weekly";
  set: ChallengeSet | null;
  best: number;
  onStart: (s: ChallengeSet) => void;
}) {
  const title = kind === "daily" ? "Daily 10" : "Weekly 25";
  const sub = kind === "daily" ? dateKey() : weekKey();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="glass-strong rounded-3xl p-6 flex flex-col"
    >
      <div className="flex items-center justify-between">
        <Badge tone={kind === "daily" ? "cyan" : "neon"}>{kind}</Badge>
        <span className="font-mono text-[11px] text-white/45">{sub}</span>
      </div>
      <h2 className="mt-4 font-display text-2xl text-white tracking-tight">{title}</h2>
      <p className="mt-2 text-white/55 text-[14px]">
        Mixed-skill rapid round. Same questions for everyone, every {kind === "daily" ? "day" : "week"}.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-wider text-white/55">
        <div className="glass rounded-xl p-3">
          <div>Questions</div>
          <div className="font-display text-lg text-white tracking-tight">{set?.count ?? "…"}</div>
        </div>
        <div className="glass rounded-xl p-3">
          <div>Your best</div>
          <div className="font-display text-lg text-white tracking-tight">{best}</div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => set && onStart(set)} disabled={!set}>
          {best > 0 ? "Replay" : "Start"} →
        </Button>
      </div>
    </motion.div>
  );
}

export function ChallengeRunner(props: {
  active: Active;
  setActive: (a: Active | null) => void;
  onExit: () => void;
}) {
  // No hooks here: the end screen and the question view are separate
  // components so neither ever calls hooks after an early return.
  if (props.active.index >= props.active.set.items.length) {
    return <ChallengeEnd active={props.active} onExit={props.onExit} />;
  }
  return <ChallengeQuestion {...props} />;
}

function ChallengeEnd({ active, onExit }: { active: Active; onExit: () => void }) {
  // Fire recordSessionEnd exactly once when the challenge is truly done.
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    const endedAt = Date.now();
    recordSessionEnd({
      mode: active.set.kind === "daily" ? "challenge_daily" : "challenge_weekly",
      skill: "mixed",
      score: active.score,
      totalQuestions: active.set.items.length,
      correct: active.correct,
      wrong: active.wrong,
      bestCombo: active.bestCombo,
      durationMs: endedAt - active.startedAt,
      createdAt: endedAt,
      periodKey: active.set.periodKey,
    });
  }, [active]);

  return (
    <div className="relative min-h-dvh pt-20 flex flex-col items-center justify-center">
      <SessionEnd
        show
        score={active.score}
        correct={active.correct}
        total={active.set.items.length}
        wrong={active.wrong}
        masteredCount={active.correct}
        missedItems={active.missedItems}
        hasNextBlock={false}
        onReplay={onExit}
      />
    </div>
  );
}

function ChallengeQuestion({
  active,
  setActive,
  onExit,
}: {
  active: Active;
  setActive: (a: Active | null) => void;
  onExit: () => void;
}) {
  // Compose 4 options for the current item.
  const current = active.set.items[active.index];
  const options = useMemo(() => {
    if (!current) return [];
    const others = pickRandomCountries(3, new Set([current.country.iso3]));
    return shuffle([current.country, ...others]);
  }, [current]);

  const pick = useCallback(
    (iso3: string) => {
      if (!current || active.answerState !== "idle") return;
      const correctPick = iso3 === current.country.iso3;
      updateSkillProgress(current.country.iso3, current.skill as Skill, (prev) =>
        confidenceAfter(prev, correctPick),
      );
      const combo = correctPick ? active.combo + 1 : 0;
      const gained = correctPick ? 100 + Math.min(combo - 1, 9) * 20 : 0;

      let nextMissed = active.missedItems;
      if (!correctPick) {
        const missedKey = `${current.country.iso3}:${current.skill}`;
        if (!active.missedItems.some((m) => m.id === missedKey)) {
          nextMissed = [
            ...active.missedItems,
            {
              id: missedKey,
              prompt: current.skill === "flag" ? "Flag" : current.country.name,
              answer:
                current.skill === "capital"
                  ? current.country.capital ?? "—"
                  : current.country.name,
              flagIso2: current.country.iso2,
              subMode: current.skill,
            },
          ];
        }
      }

      const picked = COUNTRY_BY_ISO3.get(iso3);
      setActive({
        ...active,
        answerState: correctPick ? "correct" : "wrong",
        chosen: current.skill === "capital" ? (picked?.capital ?? undefined) : picked?.name,
        score: active.score + gained,
        combo,
        bestCombo: Math.max(active.bestCombo, combo),
        correct: active.correct + (correctPick ? 1 : 0),
        wrong: active.wrong + (correctPick ? 0 : 1),
        missedItems: nextMissed,
      });
    },
    [active, current, setActive],
  );

  // An exiting feedback bar or a key press can call a stale `next`: read the latest
  // state and ignore an unanswered question, so one Next never skips one.
  const latest = useRef(active);
  latest.current = active;
  const next = useCallback(() => {
    const a = latest.current;
    if (a.answerState === "idle") return;
    setActive({ ...a, index: a.index + 1, answerState: "idle", chosen: undefined });
  }, [setActive]);

  // Numeric 1–4 + auto-advance + space-to-skip — same architecture as Find/Name/Flags.
  const hotkeyItems = useMemo(
    () =>
      current && active.answerState === "idle"
        ? options.map((o) => ({ id: o.iso3 }))
        : [],
    [current, options, active.answerState],
  );
  useAnswerHotkeys(hotkeyItems, pick);
  useSkipHotkey(useCallback(() => {
    if (current && active.answerState === "idle") {
      setActive({ ...active, answerState: "wrong", wrong: active.wrong + 1, combo: 0 });
    }
  }, [current, active, setActive]));
  useAutoAdvance({
    answerState: active.answerState === "wrong" ? "wrong" : active.answerState === "correct" ? "correct" : "idle",
    finished: false,
    next,
  });

  if (!current) return null;

  return (
    <div className="min-h-dvh pt-24 pb-10 px-6 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Badge tone={active.set.kind === "daily" ? "cyan" : "neon"}>
            {active.set.kind} · {active.index + 1}/{active.set.items.length}
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={onExit}
            aria-label="Exit challenge"
          >
            ✕ Exit
          </Button>
        </div>


        <motion.div
          key={active.index}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.crisp}
          className="mt-4 glass-strong rounded-2xl p-6 text-center"
        >
          <PromptInline item={current} />
        </motion.div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {options.map((o, i) => (
            <button
              key={o.iso3}
              disabled={active.answerState !== "idle"}
              onClick={() => pick(o.iso3)}
              className={cn(
                "glass rounded-2xl p-4 text-left transition-all duration-150",
                "hover:-translate-y-0.5 hover:border-white/25 disabled:opacity-60 disabled:hover:translate-y-0",
                active.answerState !== "idle" &&
                  o.iso3 === current.country.iso3 &&
                  "border-[color:var(--neon)]/60 shadow-[0_0_40px_-10px_color-mix(in_oklab,var(--neon)_60%,transparent)]",
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
                {i + 1}
              </div>
              <div className="mt-1 flex items-center gap-3">
                {current.skill === "flag" && (
                  <FlagImage iso2={o.iso2} alt={o.name} className="w-12 h-8 shrink-0" />
                )}
                <div className="font-display text-base text-white tracking-tight truncate">
                  {current.skill === "capital" ? (o.capital ?? "—") : o.name}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <FeedbackBar
            show={active.answerState !== "idle"}
            state={active.answerState === "wrong" ? "wrong" : "correct"}
            title={current.skill === "capital" ? (current.country.capital ?? current.country.name) : current.country.name}
            subtitle={feedbackContext(current.country)}
            chosen={active.chosen ?? null}
            flag={<FlagImage iso2={current.country.iso2} alt="" className="w-8 aspect-[3/2] rounded shrink-0" />}
            onNext={next}
          />
        </div>
      </div>
    </div>
  );
}

function PromptInline({ item }: { item: { country: Country; skill: Skill } }) {
  const { country, skill } = item;
  if (skill === "name") {
    return (
      <>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          Name this flag
        </div>
        <div className="mt-3 flex justify-center">
          <FlagImage iso2={country.iso2} alt="flag" className="w-40 aspect-[3/2]" />
        </div>
      </>
    );
  }
  if (skill === "flag") {
    return (
      <>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          Which flag
        </div>
        <div className="mt-2 font-display text-2xl text-white text-glow-cyan">{country.name}</div>
      </>
    );
  }
  if (skill === "capital") {
    return (
      <>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          Capital of
        </div>
        <div className="mt-2 font-display text-2xl text-white text-glow-cyan">{country.name}</div>
      </>
    );
  }
  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
        Country with capital
      </div>
      <div className="mt-2 font-display text-2xl text-white text-glow-cyan">
        {country.capital ?? "—"}
      </div>
    </>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

