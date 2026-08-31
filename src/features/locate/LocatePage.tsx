import { lazy, Suspense, useEffect, useMemo, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COUNTRIES, COUNTRY_BY_ISO3, pickRandomCountries } from "@/lib/countries";
import { createSessionStore } from "@/features/engine/useSession";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { SessionEnd } from "@/features/engine/SessionEnd";
import { PromptPill } from "@/features/engine/PromptPill";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { HardInput } from "@/features/engine/HardInput";
import { ModeDropdown } from "@/features/engine/ModeDropdown";
import { FlagImage } from "@/components/ui/FlagImage";
import { useAnswerHotkeys } from "@/hooks/useAnswerHotkeys";
import { selectAllForContinent } from "@/lib/mastery";
import {
  RegionSelect,
  useContinentPref,
  type ContinentChoice,
} from "@/features/engine/ContinentSelect";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import type { Country } from "@/types/country";
import { getPref, setPref } from "@/lib/db/repo";
import { useLocateSound } from "@/hooks/useLocateSound";
import { GlobeFeedbackToast, type GlobeToast } from "@/components/ui/GlobeFeedbackToast";

const Globe3D = lazy(() => import("@/features/globe/Globe3D"));

const useFindSession = createSessionStore({ mode: "find", skill: "location" });
const useNameSession = createSessionStore({ mode: "name", skill: "name" });

type SubMode = "find" | "name";
const SUB_MODE_OPTIONS = [
  { value: "find" as const, label: "Find this country" },
  { value: "name" as const, label: "Name this country" },
];

type NameDifficulty = "easy" | "hard";
const DIFFICULTY_OPTIONS = [
  { value: "easy" as const, label: "Easy" },
  { value: "hard" as const, label: "Hard" },
];

type SessionMode = "quick" | "complete";

export default function LocatePage({ initialSub }: { initialSub?: SubMode }) {
  const [sub, setSubState] = useState<SubMode>(initialSub ?? "find");
  const [difficulty, setDifficulty] = useState<NameDifficulty>("easy");
  const [sessionMode, setSessionMode] = useState<SessionMode>("quick");
  const [continent, setContinent] = useContinentPref();

  // Load & persist sub-mode
  useEffect(() => {
    if (!initialSub) {
      getPref("locate.sub").then((v) => {
        if (v === "find" || v === "name") setSubState(v);
      });
    }
  }, [initialSub]);

  const setSub = useCallback((sMode: SubMode) => {
    setSubState(sMode);
    void setPref("locate.sub", sMode);
  }, []);

  // Use the active session store depending on submode
  const findSession = useFindSession();
  const nameSession = useNameSession();
  const s = sub === "find" ? findSession : nameSession;

  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;

  // Count of countries in selected continent
  const continentCount = useMemo(() => {
    if (!continent || continent === "All") return COUNTRIES.length;
    return COUNTRIES.filter((c) => c.continent === continent).length;
  }, [continent]);

  const [lastWrongIso3, setLastWrongIso3] = useState<string | null>(null);

  // Find-mode: ephemeral centered toast (replaces bottom FeedbackBar)
  const [findToast, setFindToast] = useState<GlobeToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { playCorrect, playWrong, unlock } = useLocateSound();

  // Start / restart session logic
  const startSession = useCallback(
    (c: ContinentChoice, sMode: SubMode, findLength: SessionMode) => {
      setLastWrongIso3(null); // Reset differential feedback state
      setFindToast(null);
      if (sMode === "find" && findLength === "complete") {
        const all = selectAllForContinent(c === "All" ? null : c);
        void findSession.start({ allCountries: all, subMode: sMode });
      } else if (sMode === "find") {
        void findSession.start({ continent: c === "All" ? undefined : c, subMode: sMode });
      } else {
        void nameSession.start({ continent: c === "All" ? undefined : c, subMode: sMode });
      }
    },
    [findSession, nameSession],
  );

  useEffect(() => {
    startSession(continent, sub, sessionMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continent, sub, sessionMode]);

  useAutoAdvance({
    answerState: s.answerState,
    finished,
    next: s.next,
  });

  const onSkip = useCallback(() => {
    if (!finished && current && s.answerState === "idle") s.reveal();
  }, [finished, current, s]);
  useSkipHotkey(onSkip);

  const restartWithContinent = useCallback(
    (c: ContinentChoice) => {
      setContinent(c);
    },
    [setContinent],
  );

  // Options for Name Easy Mode (filtered by continent per Task 2 fix)
  const nameOptions = useMemo(() => {
    if (!current || sub !== "name" || difficulty !== "easy") return [];
    const others = pickRandomCountries(
      3,
      new Set([current.iso3]),
      continent === "All" ? undefined : continent,
    );
    return shuffle([current, ...others]);
  }, [current, sub, difficulty, continent]);

  const handleNameSubmit = useCallback(
    (isCorrect: boolean, country: Country) => {
      unlock();
      if (isCorrect) {
        playCorrect();
      } else {
        playWrong();
      }
      setFindToast(null); // The correct/wrong badge appears directly in 3D over the exact country
      s.submit(isCorrect);
    },
    [playCorrect, playWrong, unlock, s],
  );

  return (
    <div className="relative min-h-dvh pt-20">
      {/* 3D Globe Background */}
      <div className="absolute inset-0">
        <Suspense fallback={<GlobeFallback />}>
          <Globe3D
            countries={COUNTRIES}
            highlightIso3={
              sub === "find"
                ? s.answerState === "correct"
                  ? current?.iso3
                  : null
                : s.answerState === "idle" || s.answerState === "correct"
                  ? current?.iso3
                  : null
            }
            revealIso3={
              s.answerState === "wrong" || s.answerState === "revealed" ? current?.iso3 : null
            }
            wrongIso3={sub === "find" && s.answerState === "wrong" ? lastWrongIso3 : null}
            onCountryClick={
              sub === "find"
                ? (iso3) => {
                    if (current && s.answerState === "idle") {
                      unlock(); // Unlock audio context on first user gesture
                      const isCorrect = iso3 === current.iso3;
                      if (!isCorrect) {
                        setLastWrongIso3(iso3);
                        playWrong();
                        setFindToast(null); // No redundant banner under "Find x", 3D badge is placed directly on clicked country
                      } else {
                        playCorrect();
                        setFindToast({ kind: "correct", name: current.name });
                      }
                      // Auto-dismiss toast snappy and visual
                      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                      if (isCorrect) {
                        toastTimerRef.current = setTimeout(() => setFindToast(null), 1200);
                      }
                      s.submit(isCorrect);
                    }
                  }
                : undefined
            }
            disableHoverLabel
            questionKey={current?.iso3 ?? null}
            activeContinent={continent === "All" ? null : continent}
            autoRotateSpeed={sub === "name" ? 0.05 : undefined}
          />
        </Suspense>
      </div>

      {!finished && current && (
        <>
          {/* Top HUD Controls */}
          <div className="absolute top-24 inset-x-0 z-20 px-4 md:px-6 flex items-center justify-between pointer-events-auto max-w-5xl mx-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <RegionSelect
                value={continent}
                onChangeContinent={restartWithContinent}
                spainSkill="locate"
              />
              {sub === "find" && (
                <div
                  className="glass rounded-full p-1 flex flex-nowrap items-center gap-0.5"
                  role="group"
                  aria-label="Session length"
                >
                  <button
                    type="button"
                    onClick={() => setSessionMode("quick")}
                    aria-pressed={sessionMode === "quick"}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
                      sessionMode === "quick"
                        ? "bg-white/15 text-white"
                        : "text-white/55 hover:text-white",
                    )}
                  >
                    10 Q
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionMode("complete")}
                    aria-pressed={sessionMode === "complete"}
                    title={`All ${continentCount} countries in ${continent === "All" ? "the world" : continent}`}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
                      sessionMode === "complete"
                        ? "bg-white/15 text-white"
                        : "text-white/55 hover:text-white",
                    )}
                  >
                    All {continentCount}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ModeDropdown options={SUB_MODE_OPTIONS} value={sub} onChange={setSub} />
              {sub === "name" && (
                <ModeDropdown
                  options={DIFFICULTY_OPTIONS}
                  value={difficulty}
                  onChange={setDifficulty}
                />
              )}
            </div>
          </div>

          {/* Prompt Pill */}
          <div className="absolute top-36 md:top-32 inset-x-0 z-20 flex justify-center pointer-events-none">
            <PromptPill
              keyId={`${sub}-${current.iso3}`}
              index={s.index}
              total={s.queue.length}
              title={
                sub === "find" ? (
                  <>
                    Find <span className="text-glow-cyan">{current.name}</span>
                  </>
                ) : (
                  "Name this country"
                )
              }
            />
          </div>

          {/* Centered ripple HUD feedback toast */}
          <GlobeFeedbackToast toast={findToast} />

          {/* Answer Controls & Surface */}
          <div className="absolute bottom-8 inset-x-0 z-30 px-4">
            {sub === "name" ? (
              difficulty === "easy" ? (
                <EasyOptions
                  options={nameOptions}
                  targetIso3={current.iso3}
                  disabled={s.answerState !== "idle"}
                  onPick={(iso3) => handleNameSubmit(iso3 === current.iso3, current)}
                />
              ) : s.answerState === "idle" ? (
                <HardInput target={current} onSubmit={(ok) => handleNameSubmit(ok, current)} />
              ) : null
            ) : null}
          </div>
        </>
      )}

      <SessionEnd
        show={finished}
        score={s.score}
        masteredCount={s.masteredCount}
        correct={s.correct}
        total={s.queue.length}
        wrong={s.wrong}
        bestCombo={s.bestCombo}
        durationMs={(s.endedAt ?? 0) - s.startedAt}
        missedItems={s.missedItems}
        hasNextBlock={sessionMode !== "complete"}
        onReplay={() => startSession(continent, sub, sessionMode)}
      />
    </div>
  );
}

function EasyOptions({
  options,
  targetIso3,
  disabled = false,
  onPick,
}: {
  options: Country[];
  targetIso3: string;
  disabled?: boolean;
  onPick: (iso3: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset selection on question change
  useEffect(() => {
    setSelectedId(null);
  }, [targetIso3]);

  const hotkeyItems = useMemo(
    () => options.map((o) => ({ id: o.iso3 })),
    [options],
  );
  const onPickById = useCallback(
    (id: string) => {
      if (disabled) return;
      setSelectedId(id);
      onPick(id);
    },
    [disabled, onPick],
  );
  useAnswerHotkeys(hotkeyItems, onPickById);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="max-w-2xl mx-auto grid grid-cols-2 gap-3 pointer-events-auto"
    >
      {options.map((o, i) => {
        const isSelected = selectedId === o.iso3;
        const isTarget = o.iso3 === targetIso3;
        const showFeedback = disabled && selectedId !== null;
        const isCorrectChoice = showFeedback && isTarget;
        const isWrongChoice = showFeedback && isSelected && !isTarget;

        return (
          <motion.button
            key={o.iso3}
            disabled={disabled}
            onClick={() => {
              setSelectedId(o.iso3);
              onPick(o.iso3);
            }}
            animate={
              isCorrectChoice
                ? { scale: [1, 1.02, 1] }
                : isWrongChoice
                ? { x: [0, -3.5, 3.5, -2, 2, 0] }
                : {}
            }
            transition={{ duration: 0.2 }}
            className={cn(
              "glass rounded-2xl px-5 py-4 text-left transition-all duration-200 cursor-pointer select-none",
              !showFeedback && [
                "hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-25px_color-mix(in_oklab,var(--violet)_55%,transparent)]",
                "disabled:pointer-events-none disabled:opacity-75",
              ],
              isCorrectChoice &&
                "border-emerald-500/80 bg-emerald-950/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)]",
              isWrongChoice &&
                "border-rose-500/80 bg-rose-950/40 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.25)]",
              showFeedback && !isCorrectChoice && !isWrongChoice && "opacity-40",
              "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.25em] transition-colors",
                    isCorrectChoice
                      ? "text-emerald-400/80"
                      : isWrongChoice
                      ? "text-rose-400/80"
                      : "text-white/40",
                  )}
                >
                  {i + 1}
                </div>
                <div className="font-display text-lg text-white tracking-tight truncate">
                  {o.name}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isCorrectChoice && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="size-6 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 flex items-center justify-center"
                  >
                    <span className="text-sm font-bold leading-none">✓</span>
                  </motion.div>
                )}
                {isWrongChoice && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="size-6 rounded-full bg-rose-500/20 border border-rose-500/60 text-rose-400 flex items-center justify-center"
                  >
                    <span className="text-xs font-bold leading-none">✕</span>
                  </motion.div>
                )}
                <FlagImage iso2={o.iso2} alt={o.name} className="w-12 h-8 shrink-0" />
              </div>
            </div>
          </motion.button>
        );
      })}
      <input type="hidden" data-target={targetIso3} />
    </motion.div>
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

function GlobeFallback() {
  return (
    <div className="size-full grid place-items-center">
      <div className="size-40 rounded-full bg-gradient-to-br from-violet/30 to-cyan/20 animate-breathe blur-2xl" />
    </div>
  );
}
