/**
 * SpainPage — Complete regional learning platform for Spain's geography.
 *
 * Supported Game Modes:
 *  1. Locate: Click the target CCAA / Province on the 3D globe.
 *  2. Name: A mystery region is highlighted on the globe — identify it (Easy multiple-choice or Hard direct typing).
 *  3. Flags: Learn the 19 Autonomous Community / City flags (Flag -> Name or Name -> Flag).
 *  4. Capitals: Match each CCAA or Province with its capital city.
 *
 * Supported Administrative Levels:
 *  - Comunidades Autónomas (17 CCAA + 2 Autonomous Cities)
 *  - Provincias (50 provinces)
 *
 * Supported Session Lengths:
 *  - Quick Practice (10 questions, FSRS-weighted)
 *  - Complete (all 19 CCAA or all 50 provinces)
 */

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from "react";
import { motion } from "framer-motion";
import { COUNTRIES } from "@/lib/countries";
import { createSessionStore } from "@/features/engine/useSession";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { useAnswerHotkeys } from "@/hooks/useAnswerHotkeys";
import { SessionEnd } from "@/features/engine/SessionEnd";
import { PromptPill } from "@/features/engine/PromptPill";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { HardInput } from "@/features/engine/HardInput";
import { FlagImage } from "@/components/ui/FlagImage";
import { ModeDropdown } from "@/features/engine/ModeDropdown";
import { SessionLengthSelect, type SessionLengthMode } from "@/features/engine/SessionLengthSelect";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import {
  SPAIN_CCAA,
  SPAIN_PROVINCES,
  type SpainEntity,
  type SpainFeatureCollection,
  loadSpainCCAAFeatures,
  loadSpainProvinceFeatures,
} from "@/lib/spain";

const Globe3D = lazy(() => import("@/features/globe/Globe3D"));

// ---------------------------------------------------------------------------
// Session stores — domain="spain"
// ---------------------------------------------------------------------------

const useCCAAFindSession = createSessionStore<SpainEntity>({
  mode: "find",
  skill: "location",
  domain: "spain",
  dataset: SPAIN_CCAA,
  getId: (e) => e.id,
});

const useProvinceFindSession = createSessionStore<SpainEntity>({
  mode: "find",
  skill: "location",
  domain: "spain",
  dataset: SPAIN_PROVINCES,
  getId: (e) => e.id,
});

const useCCAANameSession = createSessionStore<SpainEntity>({
  mode: "name",
  skill: "name",
  domain: "spain",
  dataset: SPAIN_CCAA,
  getId: (e) => e.id,
});

const useProvinceNameSession = createSessionStore<SpainEntity>({
  mode: "name",
  skill: "name",
  domain: "spain",
  dataset: SPAIN_PROVINCES,
  getId: (e) => e.id,
});

const useCCAAFlagSession = createSessionStore<SpainEntity>({
  mode: "flag",
  skill: "flag",
  domain: "spain",
  dataset: SPAIN_CCAA,
  getId: (e) => e.id,
});

const useCCAACapitalSession = createSessionStore<SpainEntity>({
  mode: "capital",
  skill: "capital",
  domain: "spain",
  dataset: SPAIN_CCAA,
  getId: (e) => e.id,
});

const useProvinceCapitalSession = createSessionStore<SpainEntity>({
  mode: "capital",
  skill: "capital",
  domain: "spain",
  dataset: SPAIN_PROVINCES,
  getId: (e) => e.id,
});

// ---------------------------------------------------------------------------
// UI Options
// ---------------------------------------------------------------------------

type GameSkill = "locate" | "name" | "flags" | "capitals";
const SKILL_OPTIONS = [
  { value: "locate" as const, label: "Locate on Globe" },
  { value: "name" as const, label: "Name Region" },
  { value: "flags" as const, label: "CCAA Flags" },
  { value: "capitals" as const, label: "Capitals" },
];

type AdminLevel = "ccaa" | "provinces";
const LEVEL_OPTIONS = [
  { value: "ccaa" as const, label: "Autonomous Communities (19)" },
  { value: "provinces" as const, label: "Provinces (50)" },
];

type Difficulty = "easy" | "hard";
const DIFFICULTY_OPTIONS = [
  { value: "easy" as const, label: "Easy (Choices)" },
  { value: "hard" as const, label: "Hard (Typing)" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickRandomSpainEntities(
  count: number,
  pool: readonly SpainEntity[],
  excludeId: string,
): SpainEntity[] {
  const candidates = pool.filter((e) => e.id !== excludeId);
  const shuffled = shuffle(candidates);
  return shuffled.slice(0, count);
}

function makeCapColor(
  currentId: string | undefined,
  lastWrongId: string | null,
  answerState: string,
  skill: GameSkill,
) {
  return (d: object) => {
    const f = d as { properties?: { id?: string } };
    const fid = f.properties?.id ?? "";

    if (fid === currentId) {
      if (skill === "name") {
        if (answerState === "idle") return "rgba(0, 212, 255, 0.45)"; // Cyan target highlight
        if (answerState === "correct") return "rgba(16, 185, 129, 0.65)"; // Emerald correct
        return "rgba(244, 63, 94, 0.70)"; // Coral wrong
      }
      if (answerState === "correct") return "rgba(16, 185, 129, 0.65)";
      if (answerState === "wrong" || answerState === "revealed")
        return "rgba(16, 185, 129, 0.65)";
      return "rgba(108, 99, 255, 0.16)";
    }
    if (fid === lastWrongId && answerState === "wrong")
      return "rgba(244, 63, 94, 0.70)";

    // Clean, premium Orbita dark base color matching Locate mode
    return "rgba(108, 99, 255, 0.16)";
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpainPage() {
  const [skill, setSkill] = useState<GameSkill>("locate");
  const [level, setLevel] = useState<AdminLevel>("ccaa");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [sessionMode, setSessionMode] = useState<SessionLengthMode>("quick");

  // Stores
  const ccaaFind = useCCAAFindSession();
  const provinceFind = useProvinceFindSession();
  const ccaaName = useCCAANameSession();
  const provinceName = useProvinceNameSession();
  const ccaaFlag = useCCAAFlagSession();
  const ccaaCapital = useCCAACapitalSession();
  const provinceCapital = useProvinceCapitalSession();

  // Active store resolution
  const activeStore = useMemo(() => {
    if (skill === "locate") {
      return level === "ccaa" ? ccaaFind : provinceFind;
    }
    if (skill === "name") {
      return level === "ccaa" ? ccaaName : provinceName;
    }
    if (skill === "flags") {
      return ccaaFlag;
    }
    return level === "ccaa" ? ccaaCapital : provinceCapital;
  }, [skill, level, ccaaFind, provinceFind, ccaaName, provinceName, ccaaFlag, ccaaCapital, provinceCapital]);

  const s = activeStore;
  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;

  // Active dataset for choices/counts
  const activeDataset = useMemo(() => {
    if (skill === "flags") return SPAIN_CCAA;
    return level === "ccaa" ? SPAIN_CCAA : SPAIN_PROVINCES;
  }, [skill, level]);

  // Lazy TopoJSON geometry
  const [ccaaFeatures, setCCAAFeatures] = useState<SpainFeatureCollection | null>(null);
  const [provinceFeatures, setProvinceFeatures] = useState<SpainFeatureCollection | null>(null);

  useEffect(() => {
    void loadSpainCCAAFeatures().then(setCCAAFeatures);
    void loadSpainProvinceFeatures().then(setProvinceFeatures);
  }, []);

  const activeFeatures = (skill === "flags" || level === "ccaa") ? ccaaFeatures : provinceFeatures;
  const overlayPolygons = useMemo(() => activeFeatures?.features ?? [], [activeFeatures]);

  // Session startup
  const startSession = useCallback(
    (sk: GameSkill, lv: AdminLevel, sm: SessionLengthMode) => {
      setLastWrongId(null);
      const dataset = (sk === "flags" || lv === "ccaa") ? SPAIN_CCAA : SPAIN_PROVINCES;
      const subMode = sk === "locate" ? "find" : sk === "name" ? "name" : sk === "flags" ? "flag" : "capital";

      if (sm === "complete") {
        void activeStore.start({
          allCountries: shuffle(dataset.slice()) as SpainEntity[],
          subMode,
        });
      } else {
        void activeStore.start({ subMode });
      }
    },
    [activeStore],
  );

  useEffect(() => {
    startSession(skill, level, sessionMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, level, sessionMode]);

  useAutoAdvance({ answerState: s.answerState, finished, next: s.next });

  const [lastWrongId, setLastWrongId] = useState<string | null>(null);

  const onSkip = useCallback(() => {
    if (!finished && current && s.answerState === "idle") s.reveal();
  }, [finished, current, s]);
  useSkipHotkey(onSkip);

  // Globe POV - tight close zoom on Spain
  const SPAIN_POV = useMemo(() => {
    if (skill === "name" && current) {
      return { lat: current.coordinates[0], lng: current.coordinates[1], altitude: 0.28 };
    }
    return { lat: 39.8, lng: -3.7, altitude: 0.32 };
  }, [skill, current]);

  const capColor = useMemo(
    () => makeCapColor(current?.id, lastWrongId, s.answerState, skill),
    [current?.id, lastWrongId, s.answerState, skill],
  );

  const handleOverlayClick = useCallback(
    (d: object) => {
      if (skill !== "locate") return;
      if (!current || s.answerState !== "idle") return;
      const f = d as { properties?: { id?: string } };
      const clickedId = f.properties?.id ?? "";
      const isCorrect = clickedId === current.id;
      if (!isCorrect) setLastWrongId(clickedId);
      else setLastWrongId(null);
      s.submit(isCorrect);
    },
    [skill, current, s],
  );

  // Multiple Choice Options for Name / Flags / Capitals Easy modes
  const easyOptions = useMemo(() => {
    if (!current || difficulty !== "easy" || skill === "locate") return [];
    const others = pickRandomSpainEntities(3, activeDataset, current.id);
    return shuffle([current, ...others]);
  }, [current, difficulty, skill, activeDataset]);

  // Flag asset
  const currentFlagSrc = current?.flagCode
    ? `/assets/flags/spain/${current.flagCode}.svg`
    : undefined;

  // Prompt Title
  const promptTitle = useMemo(() => {
    if (!current) return null;
    if (skill === "locate") {
      return (
        <>
          Find <span className="text-glow-cyan">{current.name}</span>
          {currentFlagSrc && (
            <FlagImage
              src={currentFlagSrc}
              alt={`${current.name} flag`}
              className="inline-block ml-2 w-7 h-4.5 rounded-xs align-middle"
            />
          )}
        </>
      );
    }
    if (skill === "name") {
      return <>Name this {level === "ccaa" ? "autonomous community" : "province"}</>;
    }
    if (skill === "flags") {
      return <>Identify this flag</>;
    }
    // capitals
    return (
      <>
        What is the capital of <span className="text-glow-cyan">{current.name}</span>?
      </>
    );
  }, [current, skill, level, currentFlagSrc]);

  return (
    <div className="relative min-h-dvh pt-20">
      {/* 3D Globe */}
      <div className="absolute inset-0">
        <Suspense fallback={<GlobeFallback />}>
          <Globe3D
            countries={COUNTRIES}
            disableWorldPolygons
            disableMicrostates
            autoRotate={false}
            quality="high"
            highlightId={
              s.answerState === "correct"
                ? (current?.id ?? null)
                : skill === "name"
                  ? (current?.id ?? null)
                  : null
            }
            revealId={
              s.answerState === "wrong" || s.answerState === "revealed"
                ? (current?.id ?? null)
                : null
            }
            wrongId={s.answerState === "wrong" ? lastWrongId : null}
            disableHoverLabel={skill === "locate"}
            questionKey={current?.id ?? null}
            pointOfView={SPAIN_POV}
            overlayPolygons={overlayPolygons}
            overlayCapColor={capColor}
            overlaySideColor={() => "rgba(108,99,255,0.2)"}
            overlayStrokeColor={() => "rgba(255,255,255,0.75)"}
            overlayAltitude={0.012}
            overlayLabel={(d) => {
              if (skill === "locate") return "";
              const f = d as { properties?: { name?: string } };
              return f.properties?.name ?? "";
            }}
            onOverlayClick={handleOverlayClick}
          />
        </Suspense>
      </div>

      {!finished && current && (
        <>
          {/* Top HUD */}
          <div className="absolute top-24 inset-x-0 z-20 px-4 md:px-6 flex items-center justify-between pointer-events-auto max-w-5xl mx-auto flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="glass px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest text-white/80 flex items-center gap-1.5">
                <span>🇪🇸</span> Spain
              </span>
              <ModeDropdown options={SKILL_OPTIONS} value={skill} onChange={setSkill} />
              {skill !== "flags" && (
                <ModeDropdown options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
              )}
              <SessionLengthSelect
                value={sessionMode}
                onChange={setSessionMode}
                continentCount={activeDataset.length}
                continent="Spain"
              />
            </div>

            <div className="flex items-center gap-2">
              {skill !== "locate" && (
                <ModeDropdown
                  options={DIFFICULTY_OPTIONS}
                  value={difficulty}
                  onChange={setDifficulty}
                />
              )}
            </div>
          </div>

          {/* Prompt Pill */}
          <div className="absolute top-40 md:top-36 inset-x-0 z-20 flex flex-col items-center pointer-events-none gap-2">
            <PromptPill
              keyId={`spain-${skill}-${level}-${current.id}`}
              index={s.index}
              total={s.queue.length}
              title={promptTitle ?? ""}
            />
            {skill === "flags" && currentFlagSrc && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={spring.crisp}
                className="pointer-events-auto glass-strong p-2 rounded-2xl shadow-2xl border border-white/20"
              >
                <FlagImage
                  src={currentFlagSrc}
                  alt="Flag question"
                  className="w-36 h-24 rounded-lg object-cover"
                />
              </motion.div>
            )}
          </div>

          {/* Bottom Interactive Area */}
          <div className="absolute bottom-8 inset-x-0 z-30 px-4">
            {skill === "locate" ? (
              <FeedbackBar
                show={s.answerState !== "idle"}
                state={
                  (s.answerState === "idle"
                    ? "correct"
                    : s.answerState) as "correct" | "wrong" | "revealed"
                }
                title={current.name}
                subtitle={current.capital ? `Capital: ${current.capital}` : undefined}
                onNext={() => s.next()}
                onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                hideNext
              />
            ) : s.answerState === "idle" ? (
              difficulty === "easy" ? (
                <EasyOptions
                  options={easyOptions}
                  targetId={current.id}
                  labelKey={skill === "capitals" ? "capital" : "name"}
                  onPick={(id) => s.submit(id === current.id)}
                />
              ) : (
                <HardInput
                  target={current}
                  matchTarget={skill === "capitals" ? current.capital : current.name}
                  placeholder={
                    skill === "capitals"
                      ? "Type the capital city…"
                      : "Type the region name…"
                  }
                  onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                />
              )
            ) : (
              <FeedbackBar
                show
                state={s.answerState as "correct" | "wrong" | "revealed"}
                title={current.name}
                subtitle={
                  skill === "capitals"
                    ? `Capital: ${current.capital ?? "—"}`
                    : current.capital
                      ? `Capital: ${current.capital}`
                      : undefined
                }
                onNext={() => s.next()}
                onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                hideNext
              />
            )}
          </div>
        </>
      )}

      <SessionEnd
        show={finished}
        score={s.score}
        correct={s.correct}
        total={s.queue.length}
        wrong={s.wrong}
        masteredCount={s.masteredCount}
        missedItems={s.missedItems}
        hasNextBlock={sessionMode === "quick"}
        onNextBlock={() => startSession(skill, level, sessionMode)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function EasyOptions({
  options,
  targetId,
  labelKey,
  onPick,
}: {
  options: SpainEntity[];
  targetId: string;
  labelKey: "name" | "capital";
  onPick: (id: string) => void;
}) {
  const hotkeyItems = useMemo(
    () => options.map((o) => ({ id: o.id })),
    [options],
  );
  useAnswerHotkeys(hotkeyItems, onPick);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="max-w-2xl mx-auto grid grid-cols-2 gap-3 pointer-events-auto"
    >
      {options.map((o, i) => {
        const text = (labelKey === "capital" ? o.capital : o.name) ?? o.name;
        return (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={cn(
              "glass rounded-2xl px-5 py-4 text-left transition-all duration-200",
              "hover:border-white/25 hover:-translate-y-0.5",
              "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
                  {i + 1}
                </div>
                <div className="font-display text-lg text-white tracking-tight">
                  {text}
                </div>
              </div>
              {o.flagCode && (
                <FlagImage
                  src={`/assets/flags/spain/${o.flagCode}.svg`}
                  alt={o.name}
                  className="w-10 h-7 rounded-xs shrink-0 object-cover"
                />
              )}
            </div>
          </button>
        );
      })}
      <input type="hidden" data-target={targetId} />
    </motion.div>
  );
}

function GlobeFallback() {
  return (
    <div className="size-full grid place-items-center">
      <div className="size-40 rounded-full bg-gradient-to-br from-violet/30 to-cyan/20 animate-breathe blur-2xl" />
    </div>
  );
}
