import { lazy, Suspense, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { COUNTRIES, COUNTRY_BY_ISO3 } from "@/lib/countries";
import { createSessionStore } from "@/features/engine/useSession";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { SessionEnd } from "@/features/engine/SessionEnd";
import { PromptPill } from "@/features/engine/PromptPill";
import { ModeDropdown } from "@/features/engine/ModeDropdown";
import { HardInput } from "@/features/engine/HardInput";
import { Button } from "@/components/ui/orbita-button";
import { Badge } from "@/components/ui/orbita-badge";
import {
  RegionSelect,
  useContinentPref,
  type ContinentChoice,
} from "@/features/engine/ContinentSelect";
import { spring } from "@/lib/motion";
import type { Country } from "@/types/country";
import { getPref, setPref } from "@/lib/db/repo";
import { useLocateSound } from "@/hooks/useLocateSound";
import { GlobeFeedbackToast, type GlobeToast } from "@/components/ui/GlobeFeedbackToast";

const Globe3D = lazy(() => import("@/features/globe/Globe3D"));

const useCapSession = createSessionStore({ mode: "capital", skill: "capital" });

type SubMode = "countryToCap" | "capToCountry" | "locator";

const SUB_MODE_OPTIONS = [
  { value: "countryToCap" as const, label: "Country → Cap" },
  { value: "capToCountry" as const, label: "Cap → Country" },
  { value: "locator" as const, label: "Globe Locator" },
];

export default function CapitalsPage() {
  const s = useCapSession();
  const [sub, setSub] = useState<SubMode>("countryToCap");
  const [continent, setContinent] = useContinentPref();
  const [lastWrongIso3, setLastWrongIso3] = useState<string | null>(null);
  const { playCorrect, playWrong, unlock } = useLocateSound();

  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;

  // activeSub is always the chosen sub-mode (mixed removed)
  const activeSub = sub;

  // Persist sub-mode preference
  useEffect(() => {
    getPref("capitals.sub").then((sb) => sb && setSub(sb as SubMode));
  }, []);
  useEffect(() => {
    setPref("capitals.sub", sub);
  }, [sub]);

  // Restart on format changes
  useEffect(() => {
    setLastWrongIso3(null);
    void s.start({ continent: continent === "All" ? undefined : continent, subMode: sub });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continent, sub]);

  useAutoAdvance({
    answerState: s.answerState,
    finished,
    next: () => s.next(),
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

  const valid = current && current.capital;

  /** Unified Top Toolbar (Responsive Left/Right Split) */
  const Toolbar = (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 mb-4 z-20 flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <RegionSelect
          value={continent}
          onChangeContinent={restartWithContinent}
          spainSkill="capitals"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ModeDropdown options={SUB_MODE_OPTIONS} value={sub} onChange={setSub} />
      </div>
    </div>
  );

  const [delayedReveal, setDelayedReveal] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers on unmount or question change
  useEffect(() => {
    setDelayedReveal(false);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, [current?.iso3]);

  if (activeSub === "locator") {
    return (
      <div className="relative min-h-dvh pt-20">
        <div className="absolute inset-0">
          <Suspense fallback={<GlobeFallback />}>
            <Globe3D
              countries={COUNTRIES}
              highlightIso3={s.answerState === "correct" ? current?.iso3 : null}
              revealIso3={
                (s.answerState === "wrong" && delayedReveal) || s.answerState === "revealed"
                  ? current?.iso3
                  : null
              }
              wrongIso3={s.answerState === "wrong" ? lastWrongIso3 : null}
              onCountryClick={(iso3) => {
                if (current && s.answerState === "idle") {
                  unlock();
                  const isCorrect = iso3 === current.iso3;
                  if (!isCorrect) {
                    setLastWrongIso3(iso3);
                    setDelayedReveal(false);
                    playWrong();
                    // Phase 1: User error state immediately on clicked country
                    s.submit(false);
                    // Phase 2: After 600ms, reveal correct country & capital
                    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
                    revealTimerRef.current = setTimeout(() => {
                      setDelayedReveal(true);
                    }, 600);
                  } else {
                    setDelayedReveal(false);
                    playCorrect();
                    s.submit(true);
                  }
                }
              }}
              disableHoverLabel
              questionKey={current?.iso3 ?? null}
              activeContinent={continent === "All" ? null : continent}
            />
          </Suspense>
        </div>
        {!finished && current && (
          <div className="absolute top-20 inset-x-0 z-20 pointer-events-none flex flex-col items-center">
            {Toolbar}
            <PromptPill
              keyId={`${sub}-${s.index}-${current.iso3}`}
              index={s.index}
              total={s.queue.length}
              title={
                <>
                  Find the country whose capital is{" "}
                  <span className="text-glow-cyan">{current.capital}</span>
                </>
              }
            />
          </div>
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
          onReplay={() => s.start({ continent: continent === "All" ? undefined : continent, subMode: sub })}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh pt-20 flex flex-col items-center">
      {!finished && current && valid && (
        <>
          {Toolbar}

          <div className="flex-1 w-full flex flex-col items-center px-4 md:px-6 pb-32 max-w-5xl gap-6 md:gap-8">
            <PromptPill
              keyId={`${sub}-${s.index}-${current.iso3}`}
              index={s.index}
              total={s.queue.length}
              title={
                activeSub === "countryToCap" ? (
                  <>What's the capital of <span className="text-glow-cyan">{current.name}</span>?</>
                ) : (
                  <>Which country's capital is <span className="text-glow-cyan">{current.capital}</span>?</>
                )
              }
            />

            <div className="w-full flex justify-center">
              <div className="w-full max-w-md mx-auto">
                <HardInput
                  target={current}
                  matchTarget={activeSub === "countryToCap" ? (current.capital ?? undefined) : current.name}
                  correctAnswer={activeSub === "countryToCap" ? (current.capital ?? undefined) : current.name}
                  answerState={s.answerState}
                  onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                  placeholder={activeSub === "countryToCap" ? "Type the capital…" : "Type the country…"}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {!valid && current && !finished && (
        <div className="mt-20 flex flex-col items-center">
          <Badge tone="muted">No capital on file — skipping</Badge>
          <div className="mt-4">
            <Button size="sm" onClick={() => s.next()}>
              Skip
            </Button>
          </div>
        </div>
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
        onReplay={() => s.start({ continent: continent === "All" ? undefined : continent, subMode: sub })}
      />
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="size-full grid place-items-center">
      <div className="size-40 rounded-full bg-gradient-to-br from-violet/30 to-cyan/20 animate-breathe blur-2xl" />
    </div>
  );
}
