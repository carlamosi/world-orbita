/**
 * SpainPage — Complete regional learning platform for Spain's geography.
 *
 * Supported Game Modes:
 *  1. Locate: Click the target CCAA / Province on the 3D globe.
 *  2. Name: A mystery region is highlighted — identify it (Easy or Hard).
 *  3. Flags: Learn the 19 CCAA / City flags. Globe HIDDEN — large flag card + choice buttons.
 *  4. Capitals: Match each CCAA or Province with its capital city.
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
  getSpainFlagUrl,
} from "@/lib/spain";
import { useSearch } from "@tanstack/react-router";

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
  return shuffle(pool.filter((e) => e.id !== excludeId)).slice(0, count);
}

function makeCapColor(
  currentId: string | undefined,
  lastWrongId: string | null,
  hoverId: string | null,
  answerState: string,
  skill: GameSkill,
) {
  return (d: object) => {
    const f = d as { properties?: { id?: string } };
    const fid = f.properties?.id ?? "";

    if (fid === currentId) {
      if (skill === "name") {
        if (answerState === "idle") return "rgba(0, 212, 255, 0.45)";
        if (answerState === "correct") return "rgba(16, 185, 129, 0.65)";
        return "rgba(244, 63, 94, 0.70)";
      }
      if (answerState === "correct") return "rgba(16, 185, 129, 0.65)";
      if (answerState === "wrong" || answerState === "revealed")
        return "rgba(16, 185, 129, 0.65)";
      return fid === hoverId ? "rgba(0, 212, 255, 0.32)" : "rgba(108, 99, 255, 0.16)";
    }
    if (fid === lastWrongId && answerState === "wrong")
      return "rgba(244, 63, 94, 0.70)";
    if (fid === hoverId)
      return "rgba(0, 212, 255, 0.28)";

    return "rgba(108, 99, 255, 0.16)";
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpainPage() {
  const search = useSearch({ from: "/spain", shouldThrow: false }) as { skill?: GameSkill } | undefined;
  const [skill, setSkill] = useState<GameSkill>(() => search?.skill ?? "locate");

  useEffect(() => {
    if (search?.skill && search.skill !== skill) {
      setSkill(search.skill);
    }
  }, [search?.skill]);
  const [level, setLevel] = useState<AdminLevel>("ccaa");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [sessionMode, setSessionMode] = useState<SessionLengthMode>("quick");
  const [lastWrongId, setLastWrongId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  const ccaaFind = useCCAAFindSession();
  const provinceFind = useProvinceFindSession();
  const ccaaName = useCCAANameSession();
  const provinceName = useProvinceNameSession();
  const ccaaFlag = useCCAAFlagSession();
  const ccaaCapital = useCCAACapitalSession();
  const provinceCapital = useProvinceCapitalSession();

  const activeStore = useMemo(() => {
    if (skill === "locate") return level === "ccaa" ? ccaaFind : provinceFind;
    if (skill === "name") return level === "ccaa" ? ccaaName : provinceName;
    if (skill === "flags") return ccaaFlag;
    return level === "ccaa" ? ccaaCapital : provinceCapital;
  }, [skill, level, ccaaFind, provinceFind, ccaaName, provinceName, ccaaFlag, ccaaCapital, provinceCapital]);

  const s = activeStore;
  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;

  const activeDataset = useMemo(() => {
    if (skill === "flags") return SPAIN_CCAA;
    return level === "ccaa" ? SPAIN_CCAA : SPAIN_PROVINCES;
  }, [skill, level]);

  const [ccaaFeatures, setCCAAFeatures] = useState<SpainFeatureCollection | null>(null);
  const [provinceFeatures, setProvinceFeatures] = useState<SpainFeatureCollection | null>(null);

  useEffect(() => {
    void loadSpainCCAAFeatures().then(setCCAAFeatures);
    void loadSpainProvinceFeatures().then(setProvinceFeatures);
  }, []);

  const activeFeatures = (skill === "flags" || level === "ccaa") ? ccaaFeatures : provinceFeatures;
  const overlayPolygons = useMemo(() => activeFeatures?.features ?? [], [activeFeatures]);

  const startSession = useCallback(
    (sk: GameSkill, lv: AdminLevel, sm: SessionLengthMode) => {
      setLastWrongId(null);
      setHoveredRegionId(null);
      const isCCAA = sk === "flags" || lv === "ccaa";
      const dataset = isCCAA ? SPAIN_CCAA : SPAIN_PROVINCES;
      const subMode = sk === "locate" ? "find" : sk === "name" ? "name" : sk === "flags" ? "flag" : "capital";

      // CCAA is ALWAYS all 19 items across all modes
      if (isCCAA || sm === "complete") {
        void activeStore.start({ allCountries: shuffle(dataset.slice()) as SpainEntity[], subMode });
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

  const onSkip = useCallback(() => {
    if (!finished && current && s.answerState === "idle") s.reveal();
  }, [finished, current, s]);
  useSkipHotkey(onSkip);

  // Rock-solid Spain POV — slightly lower center and slightly closer zoom (alt: 0.28, lat: 39.2)
  const SPAIN_POV = useMemo(() => ({ lat: 39.2, lng: -3.7, altitude: 0.28 }), []);

  const capColor = useMemo(
    () => makeCapColor(current?.id, lastWrongId, hoveredRegionId, s.answerState, skill),
    [current?.id, lastWrongId, hoveredRegionId, s.answerState, skill],
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

  const handleOverlayHover = useCallback(
    (d: object | null) => {
      if (!d) { setHoveredRegionId(null); return; }
      const f = d as { properties?: { id?: string } };
      setHoveredRegionId(f.properties?.id ?? null);
    },
    [],
  );

  const easyOptions = useMemo(() => {
    if (!current || difficulty !== "easy" || skill === "locate") return [];
    const others = pickRandomSpainEntities(3, activeDataset, current.id);
    return shuffle([current, ...others]);
  }, [current, difficulty, skill, activeDataset]);

  const currentFlagSrc = useMemo(
    () => getSpainFlagUrl(current?.flagCode),
    [current?.flagCode],
  );

  const promptTitle = useMemo(() => {
    if (!current) return null;
    if (skill === "locate") {
      return <>Find <span className="text-glow-cyan">{current.name}</span></>;
    }
    if (skill === "name") {
      return <>Name this {level === "ccaa" ? "autonomous community" : "province"}</>;
    }
    if (skill === "flags") {
      return <>Which autonomous community owns this flag?</>;
    }
    return (
      <>
        What is the capital of <span className="text-glow-cyan">{current.name}</span>?
      </>
    );
  }, [current, skill, level]);

  const showGlobe = skill === "locate" || skill === "name";

  return (
    <div className="relative min-h-dvh pt-20 flex flex-col items-center">
      {/* 3D Globe: rendered ONLY for Locate and Name modes */}
      {showGlobe && (
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
              onOverlayHover={handleOverlayHover}
            />
          </Suspense>
        </div>
      )}

      {/* Ambient glow background for Non-Globe modes (Flags, Capitals) */}
      {!showGlobe && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(108,99,255,0.12)_0%,transparent_70%)] pointer-events-none" />
      )}

      {!finished && current && (
        <>
          {/* Top HUD with high z-index (z-40) so dropdowns are never overlapped */}
          <div
            className={cn(
              "z-40 px-4 md:px-6 flex items-center justify-between flex-wrap gap-2 pointer-events-auto",
              !showGlobe
                ? "w-full max-w-5xl mx-auto mb-4"
                : "absolute top-24 inset-x-0 max-w-5xl mx-auto",
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="glass px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest text-white/80 flex items-center gap-1.5">
                <span>🇪🇸</span> Spain
              </span>
              <ModeDropdown options={SKILL_OPTIONS} value={skill} onChange={setSkill} />
              {skill !== "flags" && (
                <ModeDropdown options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
              )}
              {skill !== "flags" && level === "provinces" && (
                <SessionLengthSelect
                  value={sessionMode}
                  onChange={setSessionMode}
                  continentCount={activeDataset.length}
                  continent="Spain"
                />
              )}
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

          {/* ================================================================
              FLAGS MODE: 2-column card layout, no globe, no flags on choices
          ================================================================ */}
          {skill === "flags" && (
            <div className="flex-1 w-full flex flex-col items-center px-4 md:px-6 pb-32 max-w-5xl gap-6 z-20">
              <PromptPill
                keyId={`spain-flags-${current.id}`}
                index={s.index}
                total={s.queue.length}
                title={promptTitle ?? ""}
              />

              <div className="w-full grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-center mt-4">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, scale: 0.92, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={spring.soft}
                  className="flex items-center justify-center"
                >
                  {currentFlagSrc ? (
                    <div className="relative overflow-hidden rounded-2xl glass shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] border border-white/20 w-full max-w-[480px] aspect-[3/2]">
                      <img
                        src={currentFlagSrc}
                        alt="Mystery flag"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-[480px] aspect-[3/2] rounded-2xl glass border border-white/10 flex items-center justify-center text-white/40 font-mono text-sm">
                      No flag available
                    </div>
                  )}
                </motion.div>

                <div className="flex flex-col justify-center gap-3">
                  {s.answerState === "idle" ? (
                    difficulty === "easy" ? (
                      <EasyOptions
                        options={easyOptions}
                        targetId={current.id}
                        labelKey="name"
                        showFlags={false}
                        disabled={s.answerState !== "idle"}
                        onPick={(id) => s.submit(id === current.id)}
                      />
                    ) : (
                      <HardInput
                        target={current}
                        matchTarget={current.name}
                        placeholder="Type the autonomous community name…"
                        onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                      />
                    )
                  ) : (
                    <div className="max-w-2xl mx-auto w-full">
                      <FeedbackBar
                        show
                        state={s.answerState as "correct" | "wrong" | "revealed"}
                        title={current.name}
                        subtitle={current.capital ? `Capital: ${current.capital}` : undefined}
                        onNext={() => s.next()}
                        onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                        hideNext
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              CAPITALS MODE: Clean card layout, no globe
          ================================================================ */}
          {skill === "capitals" && (
            <div className="flex-1 w-full flex flex-col items-center px-4 md:px-6 pb-32 max-w-3xl gap-6 z-20">
              <PromptPill
                keyId={`spain-capitals-${level}-${current.id}`}
                index={s.index}
                total={s.queue.length}
                title={promptTitle ?? ""}
              />

              <div className="w-full flex flex-col items-center mt-6">
                {s.answerState === "idle" ? (
                  difficulty === "easy" ? (
                    <div className="w-full">
                      <EasyOptions
                        options={easyOptions}
                        targetId={current.id}
                        labelKey="capital"
                        showFlags={false}
                        disabled={s.answerState !== "idle"}
                        onPick={(id) => s.submit(id === current.id)}
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-lg">
                      <HardInput
                        target={current}
                        matchTarget={current.capital ?? ""}
                        placeholder="Type the capital city…"
                        onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                      />
                    </div>
                  )
                ) : (
                  <div className="w-full max-w-2xl">
                    <FeedbackBar
                      show
                      state={s.answerState as "correct" | "wrong" | "revealed"}
                      title={current.name}
                      subtitle={`Capital: ${current.capital ?? "—"}`}
                      onNext={() => s.next()}
                      onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                      hideNext
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              MAP MODES: Locate / Name
          ================================================================ */}
          {showGlobe && (
            <>
              <div className="absolute top-40 md:top-36 inset-x-0 z-20 flex flex-col items-center pointer-events-none">
                <PromptPill
                  keyId={`spain-${skill}-${level}-${current.id}`}
                  index={s.index}
                  total={s.queue.length}
                  title={promptTitle ?? ""}
                />
              </div>

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
                      labelKey="name"
                      showFlags={false}
                      disabled={s.answerState !== "idle"}
                      onPick={(id) => s.submit(id === current.id)}
                    />
                  ) : (
                    <HardInput
                      target={current}
                      matchTarget={current.name}
                      placeholder="Type the region name…"
                      onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                    />
                  )
                ) : (
                  <FeedbackBar
                    show
                    state={s.answerState as "correct" | "wrong" | "revealed"}
                    title={current.name}
                    subtitle={current.capital ? `Capital: ${current.capital}` : undefined}
                    onNext={() => s.next()}
                    onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                    hideNext
                  />
                )}
              </div>
            </>
          )}
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
        hasNextBlock={level === "provinces" && sessionMode === "quick"}
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
  showFlags = false,
  disabled = false,
  onPick,
}: {
  options: SpainEntity[];
  targetId: string;
  labelKey: "name" | "capital";
  showFlags?: boolean;
  disabled?: boolean;
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
        const flagSrc = showFlags ? getSpainFlagUrl(o.flagCode) : undefined;
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(o.id)}
            className={cn(
              "glass rounded-2xl px-5 py-4 text-left transition-all duration-200 cursor-pointer select-none",
              "hover:bg-white/[0.08] hover:border-white/25 hover:-translate-y-0.5 hover:shadow-lg",
              "active:scale-[0.98]",
              "disabled:pointer-events-none disabled:opacity-75",
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
              {flagSrc && (
                <div className="w-10 h-7 rounded-sm shrink-0 overflow-hidden border border-white/15 shadow-md">
                  <img
                    src={flagSrc}
                    alt={o.name}
                    className="w-full h-full object-cover"
                  />
                </div>
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
