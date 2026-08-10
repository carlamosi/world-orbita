import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { COUNTRIES } from "@/lib/countries";
import {
  type HardcoreExamState,
  type HardcoreQuestionItem,
  saveHardcoreProgress,
  clearHardcoreProgress,
} from "@/lib/hardcore";
import { SessionEnd } from "@/features/engine/SessionEnd";
import { PromptPill } from "@/features/engine/PromptPill";
import { FeedbackBar } from "@/features/engine/FeedbackBar";
import { HardInput } from "@/features/engine/HardInput";
import { useSkipHotkey } from "@/hooks/useSkipHotkey";
import { useAutoAdvance } from "@/features/engine/useAutoAdvance";
import { Button } from "@/components/ui/orbita-button";
import { Badge } from "@/components/ui/orbita-badge";
import { spring } from "@/lib/motion";

const Globe3D = lazy(() => import("@/features/globe/Globe3D"));

export function HardcoreRunner({
  initialState,
  onExit,
}: {
  initialState: HardcoreExamState;
  onExit: () => void;
}) {
  const [state, setState] = useState<HardcoreExamState>(initialState);
  const [answerState, setAnswerState] = useState<"idle" | "correct" | "wrong" | "revealed">("idle");

  const current: HardcoreQuestionItem | undefined = state.queue[state.currentIndex];
  const finished = state.currentIndex >= state.queue.length;

  // Auto save progress on index or state update
  useEffect(() => {
    void saveHardcoreProgress(state);
  }, [state]);

  const submitAnswer = useCallback(
    (isCorrect: boolean) => {
      if (answerState !== "idle" || !current) return;

      const nextAnswerState = isCorrect ? "correct" : "wrong";
      setAnswerState(nextAnswerState);

      setState((prev) => {
        const nextCombo = isCorrect ? prev.combo + 1 : 0;
        const nextScore = prev.score + (isCorrect ? 100 + prev.combo * 10 : 0);
        const answers = [...prev.answers];
        answers[prev.currentIndex] = nextAnswerState;

        return {
          ...prev,
          score: nextScore,
          correct: prev.correct + (isCorrect ? 1 : 0),
          wrong: prev.wrong + (isCorrect ? 0 : 1),
          combo: nextCombo,
          bestCombo: Math.max(prev.bestCombo, nextCombo),
          answers,
          updatedAt: Date.now(),
        };
      });
    },
    [answerState, current],
  );

  const nextQuestion = useCallback(() => {
    setAnswerState("idle");
    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      const isDone = nextIndex >= prev.queue.length;
      return {
        ...prev,
        currentIndex: nextIndex,
        completedAt: isDone ? Date.now() : null,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const revealAnswer = useCallback(() => {
    if (answerState === "idle") {
      setAnswerState("revealed");
      setState((prev) => ({
        ...prev,
        wrong: prev.wrong + 1,
        combo: 0,
        updatedAt: Date.now(),
      }));
    }
  }, [answerState]);

  useAutoAdvance({
    answerState,
    finished,
    next: nextQuestion,
  });

  const onSkip = useCallback(() => {
    if (!finished && current && answerState === "idle") revealAnswer();
  }, [finished, current, answerState, revealAnswer]);
  useSkipHotkey(onSkip);

  // Globe POV focus
  const pov = useMemo(() => {
    if (!current) return undefined;
    if (current.type !== "locate") {
      return { lat: current.coordinates[0], lng: current.coordinates[1], altitude: 1.2 };
    }
    return undefined;
  }, [current]);

  const targetCountry = useMemo(() => {
    if (!current) return null;
    return COUNTRIES.find((c) => c.iso3 === current.iso3) ?? null;
  }, [current]);

  if (finished) {
    return (
      <div className="relative min-h-dvh pt-20 flex flex-col items-center justify-center">
        <SessionEnd
          show
          score={state.score}
          correct={state.correct}
          total={state.queue.length}
          wrong={state.wrong}
          bestCombo={state.bestCombo}
          durationMs={Date.now() - state.startedAt}
          onReplay={() => {
            void clearHardcoreProgress(state.continent);
            onExit();
          }}
        />
      </div>
    );
  }

  if (!current || !targetCountry) return null;

  return (
    <div className="relative min-h-dvh pt-20 flex flex-col items-center">
      {/* 3D Globe View */}
      <div className="absolute inset-0">
        <Suspense fallback={<GlobeFallback />}>
          <Globe3D
            countries={COUNTRIES}
            highlightIso3={
              current.type === "locate"
                ? answerState === "correct"
                  ? current.iso3
                  : null
                : answerState === "idle" || answerState === "correct"
                  ? current.iso3
                  : null
            }
            revealIso3={answerState === "wrong" || answerState === "revealed" ? current.iso3 : null}
            onCountryClick={
              current.type === "locate"
                ? (iso3) => answerState === "idle" && submitAnswer(iso3 === current.iso3)
                : undefined
            }
            disableHoverLabel={current.type === "locate"}
            pointOfView={pov}
            activeContinent={state.continent}
            questionKey={`${current.id}-${state.currentIndex}`}
          />
        </Suspense>
      </div>

      {/* Header HUD */}
      <div className="absolute top-24 inset-x-0 z-20 px-4 md:px-6 flex items-center justify-between pointer-events-auto max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Badge tone="coral">Hardcore Exam</Badge>
          <Badge tone="muted">{state.continent}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>
          Save & Exit
        </Button>
      </div>

      {/* Prompt Pill */}
      <div className="absolute top-36 md:top-32 inset-x-0 z-20 flex justify-center pointer-events-none">
        <PromptPill
          keyId={`${current.id}-${state.currentIndex}`}
          index={state.currentIndex}
          total={state.queue.length}
          title={
            current.type === "locate" ? (
              <>
                Find <span className="text-glow-cyan">{current.countryName}</span>
              </>
            ) : current.type === "name" ? (
              "Name this country"
            ) : current.type === "countryToCap" ? (
              <>
                What's the capital of <span className="text-glow-cyan">{current.countryName}</span>?
              </>
            ) : (
              <>
                Which country's capital is <span className="text-glow-cyan">{current.capital}</span>?
              </>
            )
          }
        />
      </div>

      {/* Answer Surface */}
      <div className="absolute bottom-8 inset-x-0 z-30 px-4">
        {answerState === "idle" ? (
          current.type !== "locate" ? (
            <div className="w-full max-w-md mx-auto pointer-events-auto">
              <HardInput
                target={targetCountry}
                matchTarget={
                  current.type === "countryToCap" ? current.capital : current.countryName
                }
                onSubmit={(ok) => submitAnswer(ok)}
                placeholder={
                  current.type === "countryToCap" ? "Type the capital…" : "Type the country…"
                }
              />
            </div>
          ) : null
        ) : (
          <div className="pointer-events-auto">
            <FeedbackBar
              show
              state={answerState as "correct" | "wrong" | "revealed"}
              title={`${current.countryName} ${current.capital ? `— ${current.capital}` : ""}`}
              subtitle={
                current.type === "countryToCap"
                  ? `Capital: ${current.capital}`
                  : `Country: ${current.countryName}`
              }
              onNext={nextQuestion}
              onSkip={answerState === "wrong" ? revealAnswer : undefined}
              hideNext
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="size-full grid place-items-center">
      <div className="size-40 rounded-full bg-gradient-to-br from-coral/30 to-violet/20 animate-breathe blur-2xl" />
    </div>
  );
}
