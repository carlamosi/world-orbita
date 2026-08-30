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

  // Globe POV
  const pov = useMemo(() => {
    if (!current) return undefined;
    if (sub === "name") {
      return { lat: current.coordinates[0], lng: current.coordinates[1], altitude: 1.2 };
    }
    return undefined;
  }, [sub, current?.iso3, current?.coordinates]);

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
                        const wrongCountry = COUNTRY_BY_ISO3.get(iso3);
                        setFindToast({ kind: "wrong", name: current.name, wrongName: wrongCountry?.name });
                      } else {
                        playCorrect();
                        setFindToast({ kind: "correct", name: current.name });
                      }
                      // Auto-dismiss toast
                      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                      toastTimerRef.current = setTimeout(() => setFindToast(null), isCorrect ? 1100 : 2600);
                      s.submit(isCorrect);
                    }
                  }
                : undefined
            }
            disableHoverLabel={sub === "find"}
            questionKey={current?.iso3 ?? null}
            pointOfView={pov}
            activeContinent={continent === "All" ? null : continent}
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

          {/* Find-mode: centered ripple feedback toast (replaces bottom bar) */}
          {sub === "find" && (
            <GlobeFeedbackToast toast={findToast} />
          )}

          {/* Answer Controls & Surface */}
          <div className="absolute bottom-8 inset-x-0 z-30 px-4">
            {sub === "name" ? (
              s.answerState === "idle" ? (
                difficulty === "easy" ? (
                  <EasyOptions
                    options={nameOptions}
                    targetIso3={current.iso3}
                    onPick={(iso3) => s.submit(iso3 === current.iso3)}
                  />
                ) : (
                  <HardInput target={current} onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })} />
                )
              ) : (
                <FeedbackBar
                  show
                  state={s.answerState as "correct" | "wrong" | "revealed"}
                  title={current.name}
                  subtitle={`Capital: ${current.capital ?? "—"}`}
                  onNext={() => s.next()}
                  onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                  hideNext
                />
              )
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
  onPick,
}: {
  options: Country[];
  targetIso3: string;
  onPick: (iso3: string) => void;
}) {
  const hotkeyItems = useMemo(
    () => options.map((o) => ({ id: o.iso3 })),
    [options],
  );
  const onPickById = useCallback((id: string) => onPick(id), [onPick]);
  useAnswerHotkeys(hotkeyItems, onPickById);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="max-w-2xl mx-auto grid grid-cols-2 gap-3 pointer-events-auto"
    >
      {options.map((o, i) => (
        <button
          key={o.iso3}
          onClick={() => onPick(o.iso3)}
          className={cn(
            "glass rounded-2xl px-5 py-4 text-left transition-all duration-200",
            "hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-25px_color-mix(in_oklab,var(--violet)_55%,transparent)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
                {i + 1}
              </div>
              <div className="font-display text-lg text-white tracking-tight">{o.name}</div>
            </div>
            <FlagImage iso2={o.iso2} alt={o.name} className="w-12 h-8 shrink-0" />
          </div>
        </button>
      ))}
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
