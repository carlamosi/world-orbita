/**
 * SpainPage — Locate Spain's Autonomous Communities and Provinces on the globe.
 *
 * Architecture:
 *  - Uses the generic `createSessionStore` from Phase 1 with domain="spain"
 *  - Uses Globe3D with `onOverlayClick` / `highlightId` / `revealId` / `wrongId`
 *    (Phase 1 + Phase 2 props) — world-country layer is unchanged
 *  - Spain TopoJSON is loaded lazily via loadSpainCCAAFeatures /
 *    loadSpainProvinceFeatures and passed as `overlayPolygons` to Globe3D
 *  - CCAA flags are rendered via FlagImage with the `src` prop added in Phase 1
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
import { SessionEnd } from "@/features/engine/SessionEnd";
import { PromptPill } from "@/features/engine/PromptPill";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { FlagImage } from "@/components/ui/FlagImage";
import { ModeDropdown } from "@/features/engine/ModeDropdown";
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
// Session stores — one per administrative level
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminLevel = "ccaa" | "provinces";
const LEVEL_OPTIONS = [
  { value: "ccaa" as const, label: "Comunidades Autónomas" },
  { value: "provinces" as const, label: "Provincias" },
];

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function makeCapColor(
  currentId: string | undefined,
  lastWrongId: string | null,
  answerState: string,
) {
  return (d: object) => {
    const f = d as { properties?: { id?: string } };
    const fid = f.properties?.id ?? "";
    if (fid === currentId) {
      if (answerState === "correct") return "rgba(16,185,129,0.75)";
      if (answerState === "wrong" || answerState === "revealed")
        return "rgba(16,185,129,0.65)";
      return "rgba(108,99,255,0.45)";
    }
    if (fid === lastWrongId && answerState === "wrong")
      return "rgba(244,63,94,0.75)";
    return "rgba(108,99,255,0.12)";
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpainPage() {
  const [level, setLevel] = useState<AdminLevel>("ccaa");

  const ccaaSession = useCCAAFindSession();
  const provinceSession = useProvinceFindSession();
  const s = level === "ccaa" ? ccaaSession : provinceSession;

  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;

  // Spain polygon overlays (lazy-loaded TopoJSON)
  const [ccaaFeatures, setCCAAFeatures] =
    useState<SpainFeatureCollection | null>(null);
  const [provinceFeatures, setProvinceFeatures] =
    useState<SpainFeatureCollection | null>(null);

  useEffect(() => {
    void loadSpainCCAAFeatures().then(setCCAAFeatures);
    void loadSpainProvinceFeatures().then(setProvinceFeatures);
  }, []);

  const activeFeatures =
    level === "ccaa" ? ccaaFeatures : provinceFeatures;

  const overlayPolygons = useMemo(
    () => activeFeatures?.features ?? [],
    [activeFeatures],
  );

  // Start session on mount and on level change
  const startSession = useCallback(
    (lv: AdminLevel) => {
      const store = lv === "ccaa" ? ccaaSession : provinceSession;
      void store.start({ subMode: "find" });
    },
    [ccaaSession, provinceSession],
  );

  useEffect(() => {
    startSession(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useAutoAdvance({ answerState: s.answerState, finished, next: s.next });

  const [lastWrongId, setLastWrongId] = useState<string | null>(null);

  const onSkip = useCallback(() => {
    if (!finished && current && s.answerState === "idle") s.reveal();
  }, [finished, current, s]);
  useSkipHotkey(onSkip);

  const capColor = useMemo(
    () => makeCapColor(current?.id, lastWrongId, s.answerState),
    [current?.id, lastWrongId, s.answerState],
  );

  // Globe POV: zoom Spain
  const SPAIN_POV = { lat: 40.0, lng: -3.5, altitude: 0.6 };

  const handleOverlayClick = useCallback(
    (d: object) => {
      if (!current || s.answerState !== "idle") return;
      const f = d as { properties?: { id?: string } };
      const clickedId = f.properties?.id ?? "";
      const isCorrect = clickedId === current.id;
      if (!isCorrect) setLastWrongId(clickedId);
      else setLastWrongId(null);
      s.submit(isCorrect);
    },
    [current, s],
  );

  // Flag URL for current CCAA entity
  const currentFlagSrc = current?.flagCode
    ? `/assets/flags/spain/${current.flagCode}.svg`
    : undefined;

  return (
    <div className="relative min-h-dvh pt-20">
      {/* 3D Globe */}
      <div className="absolute inset-0">
        <Suspense fallback={<GlobeFallback />}>
          <Globe3D
            countries={COUNTRIES}
            highlightId={
              s.answerState === "correct" ? (current?.id ?? null) : null
            }
            revealId={
              s.answerState === "wrong" || s.answerState === "revealed"
                ? (current?.id ?? null)
                : null
            }
            wrongId={s.answerState === "wrong" ? lastWrongId : null}
            disableHoverLabel
            questionKey={current?.id ?? null}
            pointOfView={SPAIN_POV}
            overlayPolygons={overlayPolygons}
            overlayCapColor={capColor}
            overlaySideColor={() => "rgba(108,99,255,0.05)"}
            overlayStrokeColor={() => "rgba(255,255,255,0.22)"}
            overlayAltitude={0.005}
            overlayLabel={(d) => {
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
          <div className="absolute top-24 inset-x-0 z-20 px-4 md:px-6 flex items-center justify-between pointer-events-auto max-w-5xl mx-auto">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              España
            </span>
            <ModeDropdown
              options={LEVEL_OPTIONS}
              value={level}
              onChange={setLevel}
            />
          </div>

          {/* Prompt Pill */}
          <div className="absolute top-36 md:top-32 inset-x-0 z-20 flex justify-center pointer-events-none">
            <PromptPill
              keyId={`spain-${level}-${current.id}`}
              index={s.index}
              total={s.queue.length}
              title={
                <>
                  Find{" "}
                  <span className="text-glow-cyan">{current.name}</span>
                  {currentFlagSrc && (
                    <FlagImage
                      src={currentFlagSrc}
                      alt={`${current.name} flag`}
                      className="inline-block ml-2 w-8 h-5 rounded-sm align-middle"
                    />
                  )}
                </>
              }
            />
          </div>

          {/* Feedback Bar */}
          <div className="absolute bottom-8 inset-x-0 z-30 px-4">
            <FeedbackBar
              show={s.answerState !== "idle"}
              state={
                (s.answerState === "idle"
                  ? "correct"
                  : s.answerState) as "correct" | "wrong" | "revealed"
              }
              title={current.name}
              subtitle={
                current.capital ? `Capital: ${current.capital}` : undefined
              }
              onNext={() => s.next()}
              onSkip={
                s.answerState === "wrong" ? () => s.reveal() : undefined
              }
              hideNext
            />
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
        hasNextBlock
        onNextBlock={() => startSession(level)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function GlobeFallback() {
  return (
    <div className="size-full grid place-items-center">
      <div className="size-40 rounded-full bg-gradient-to-br from-violet/30 to-cyan/20 animate-breathe blur-2xl" />
    </div>
  );
}
