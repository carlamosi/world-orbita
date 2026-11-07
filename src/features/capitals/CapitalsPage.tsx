import { lazy, Suspense, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { COUNTRIES, COUNTRY_BY_ISO3 } from "@/lib/countries";
import { createSessionStore } from "@/features/engine/useSession";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { SessionEnd } from "@/features/engine/SessionEnd";
import { SessionEmpty } from "@/features/engine/SessionEmpty";
import { PromptPill } from "@/features/engine/PromptPill";
import { ModeDropdown } from "@/features/engine/ModeDropdown";
import { HardInput } from "@/features/engine/HardInput";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { feedbackContext } from "@/features/engine/feedbackContext";
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
import { parseConceptId } from "@/lib/fsrs/concept";

const Globe3D = lazy(() => import("@/features/globe/Globe3D"));

const useCapSession = createSessionStore({
  mode: "capital",
  skill: "capital",
  mixedSubModes: ["countryToCap", "capToCountry"],
});

type SubMode = "mixed" | "locator";

const SUB_MODE_OPTIONS = [
  { value: "mixed" as const, label: "Mixed" },
  { value: "locator" as const, label: "Globe Locator" },
];

export default function CapitalsPage() {
  const s = useCapSession();
  const [sub, setSub] = useState<SubMode>("mixed");
  const [continent, setContinent] = useContinentPref();
  const [lastWrongIso3, setLastWrongIso3] = useState<string | null>(null);

  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;
  const empty = !finished && s.status === "empty";

  // In Mixed each question carries its own direction, from the concept it grades.
  const askCapital =
    parseConceptId(s.pairs[s.index]?.conceptId ?? "").subMode !== "capToCountry";

  // Persist sub-mode preference; the old single-direction modes became Mixed.
  useEffect(() => {
    getPref("capitals.sub").then((sb) => sb && setSub(sb === "locator" ? "locator" : "mixed"));
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

  const feedback = !finished && current && (
    <div className="fixed bottom-0 inset-x-0 pb-6 px-4 md:px-6 z-30 pointer-events-none">
      <div className="pointer-events-auto">
        <FeedbackBar
          show={s.answerState !== "idle"}
          state={s.answerState === "idle" ? "correct" : s.answerState}
          title={(askCapital ? current.capital : current.name) ?? ""}
          subtitle={feedbackContext(current)}
          chosen={s.chosen}
          onNext={() => s.next()}
          srOnly={sub === "locator"}
        />
      </div>
    </div>
  );

  if (sub === "locator") {
    return (
      <div className="relative min-h-dvh pt-20">
        <div className="absolute inset-0">
          <Suspense fallback={<GlobeFallback />}>
            <Globe3D
              countries={COUNTRIES}
              highlightIso3={s.answerState === "correct" ? current?.iso3 : null}
              revealIso3={
                s.answerState === "wrong" || s.answerState === "revealed"
                  ? current?.iso3
                  : null
              }
              wrongIso3={s.answerState === "wrong" ? lastWrongIso3 : null}
              onCountryClick={(iso3) => {
                if (current && s.answerState === "idle") {
                  const isCorrect = iso3 === current.iso3;
                  if (!isCorrect) {
                    setLastWrongIso3(iso3);
                  }
                  s.submit(isCorrect, { chosen: COUNTRY_BY_ISO3.get(iso3)?.name });
                }
              }}
              disableHoverLabel
              labelHighlight={s.answerState === "correct"}
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
        {feedback}
        {empty && (
          <div className="absolute top-20 inset-x-0 z-20 flex flex-col items-center px-4">
            {Toolbar}
            <SessionEmpty
              reason={s.emptyReason}
              hasSeen={s.hasSeen}
              onPractice={() => void s.startPractice()}
            />
          </div>
        )}
        <SessionEnd
          show={finished}
          score={s.score}
          firstTryCorrect={s.firstTryCorrect}
          masteredNow={s.masteredNow}
          trickyItems={s.trickyItems}
          correct={s.correct}
          total={s.cardCount}
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
                askCapital ? (
                  <>What's the capital of <span className="text-glow-cyan">{current.name}</span>?</>
                ) : (
                  <>Which country's capital is <span className="text-glow-cyan">{current.capital}</span>?</>
                )
              }
            />

            <div className="w-full flex justify-center">
              <div className="w-full max-w-md mx-auto">
                <HardInput
                  // Mixed can ask the same country in both directions: reset per slot, not per country.
                  key={s.index}
                  target={current}
                  matchTarget={askCapital ? (current.capital ?? undefined) : current.name}
                  kind={askCapital ? "capital" : "country"}
                  answerState={s.answerState}
                  onSubmit={(ok, exact, typed) => s.submit(ok, { retrievalMode: "hard", softCorrect: ok && !exact, chosen: typed })}
                  placeholder={askCapital ? "Type the capital…" : "Type the country…"}
                />
              </div>
            </div>
          </div>
          {feedback}
        </>
      )}

      {empty && (
        <>
          {Toolbar}
          <div className="w-full px-4 md:px-6 max-w-5xl">
            <SessionEmpty
              reason={s.emptyReason}
              hasSeen={s.hasSeen}
              onPractice={() => void s.startPractice()}
            />
          </div>
        </>
      )}

      {!valid && current && !finished && (
        <div className="mt-20 flex flex-col items-center">
          <Badge tone="muted">No capital on file — skipping</Badge>
          <div className="mt-4">
            <Button size="sm" onClick={() => s.next({ allowIdle: true })}>
              Skip
            </Button>
          </div>
        </div>
      )}

      <SessionEnd
        show={finished}
        score={s.score}
        firstTryCorrect={s.firstTryCorrect}
        masteredNow={s.masteredNow}
        trickyItems={s.trickyItems}
        correct={s.correct}
        total={s.cardCount}
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
