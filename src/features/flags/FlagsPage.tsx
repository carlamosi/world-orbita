import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { COUNTRIES, pickRandomCountries } from "@/lib/countries";
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
import {
  RegionSelect,
  useContinentPref,
  type ContinentChoice,
} from "@/features/engine/ContinentSelect";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import type { Country } from "@/types/country";
import { getPref, setPref } from "@/lib/db/repo";

const useFlagSession = createSessionStore({ mode: "flag", skill: "flag" });

type SubMode = "flagToCountry" | "flagToType";

const SUB_MODE_OPTIONS = [
  { value: "flagToCountry" as const, label: "Easy (Flag → Country)" },
  { value: "flagToType" as const, label: "Hard (Flag → Type)" },
];

export default function FlagsPage() {
  const s = useFlagSession();
  const [sub, setSub] = useState<SubMode>("flagToCountry");
  const [continent, setContinent] = useContinentPref();
  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;

  // Persist sub-mode preference
  useEffect(() => {
    getPref("flags.sub").then((v) => {
      if (v === "flagToCountry" || v === "flagToType") {
        setSub(v as SubMode);
      }
    });
  }, []);
  useEffect(() => {
    setPref("flags.sub", sub);
  }, [sub]);

  // Restart session whenever continent or sub-mode changes
  useEffect(() => {
    void s.start({ continent: continent === "All" ? undefined : continent, subMode: sub });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continent, sub]);

  useAutoAdvance({ answerState: s.answerState, finished, next: s.next });

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

  const options = useMemo(() => {
    if (!current || sub === "flagToType") return [];
    const distractors = pickRandomCountries(
      3,
      new Set([current.iso3]),
      continent === "All" ? undefined : continent,
    );
    return shuffle([current, ...distractors]);
  }, [current, sub, continent]);

  const hotkeyItems = useMemo(
    () =>
      s.answerState === "idle" && sub !== "flagToType"
        ? options.map((o) => ({ id: o.iso3 }))
        : [],
    [options, s.answerState, sub],
  );
  const onHotkey = useCallback(
    (id: string) => current && s.submit(id === current.iso3),
    [current, s],
  );
  useAnswerHotkeys(hotkeyItems, onHotkey);

  return (
    <div className="relative min-h-dvh pt-20 flex flex-col items-center">
      {!finished && (current || s.loading) && (
        <>
          {s.loading && !current ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="size-8 rounded-full border-2 border-white/10 border-t-[color:var(--cyan)] animate-spin" />
            </div>
          ) : (
            <>
              {/* Minimized HUD Toolbar */}
              <div className="w-full max-w-5xl mx-auto px-4 md:px-6 mb-4 z-20 flex items-center justify-between gap-4">
                <RegionSelect
                  value={continent}
                  onChangeContinent={restartWithContinent}
                  spainSkill="flags"
                />
                <ModeDropdown
                  options={SUB_MODE_OPTIONS}
                  value={sub}
                  onChange={setSub}
                />
              </div>

              {/* Gameplay Content Area */}
              <div className="flex-1 w-full flex flex-col items-center px-4 md:px-6 pb-32 max-w-5xl gap-6 md:gap-8">
                <PromptPill
                  keyId={`${sub}-${current?.iso3 ?? ''}`}
                  index={s.index}
                  total={s.queue.length}
                  title={
                    sub === "flagToCountry" ? (
                      "Which country owns this flag?"
                    ) : (
                      "Name this flag"
                    )
                  }
                />

                <div className="w-full flex justify-center">
                  {sub === "flagToCountry" && current ? (
                    <FlagToCountry
                      target={current}
                      options={options}
                      disabled={s.answerState !== "idle"}
                      onPick={(iso3) => s.submit(iso3 === current.iso3)}
                    />
                  ) : sub === "flagToCountry" ? null : (
                    current ? (
                      <FlagToType
                        target={current}
                        onSubmit={(ok) => s.submit(ok, { retrievalMode: "hard" })}
                      />
                    ) : null
                  )}
                </div>
              </div>

              {/* Feedback bar */}
              <div className="fixed bottom-0 inset-x-0 pb-6 px-4 md:px-6 z-30 pointer-events-none">
                <div className="pointer-events-auto">
                  <FeedbackBar
                    show={s.answerState !== "idle"}
                    state={s.answerState as "correct" | "wrong" | "revealed"}
                    title={current?.name ?? ""}
                    subtitle={`Capital: ${current?.capital ?? "—"}`}
                    onNext={() => s.next()}
                    onSkip={s.answerState === "wrong" ? () => s.reveal() : undefined}
                    hideNext
                  />
                </div>
              </div>
            </>
          )}
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
        onReplay={() => s.start({ continent: continent === "All" ? undefined : continent, subMode: sub })}
      />
    </div>
  );
}

function FlagToCountry({
  target,
  options,
  disabled,
  onPick,
}: {
  target: Country;
  options: Country[];
  disabled: boolean;
  onPick: (iso3: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset selected option when question/target changes
  useEffect(() => {
    setSelectedId(null);
  }, [target.iso3]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-stretch">
      {/* Left: Floating Flag */}
      <motion.div
        key={target.iso3}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring.soft}
        className="flex items-center justify-center"
      >
        <FlagImage
          iso2={target.iso2}
          alt="Mystery flag"
          size={640}
          className="w-full max-w-[480px] h-auto aspect-[3/2] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden"
        />
      </motion.div>

      {/* Right: Answer Stack */}
      <div className="flex flex-col justify-center gap-3 w-full">
        {options.map((o, i) => {
          const isSelected = selectedId === o.iso3;
          const isTarget = o.iso3 === target.iso3;
          const showFeedback = disabled && selectedId !== null;
          const isCorrectChoice = showFeedback && isTarget;
          const isWrongChoice = showFeedback && isSelected && !isTarget;

          return (
            <motion.button
              key={o.iso3}
              onClick={() => {
                setSelectedId(o.iso3);
                onPick(o.iso3);
              }}
              disabled={disabled}
              animate={
                isCorrectChoice
                  ? { scale: [1, 1.02, 1] }
                  : isWrongChoice
                  ? { x: [0, -3.5, 3.5, -2, 2, 0] }
                  : {}
              }
              transition={{ duration: 0.2 }}
              className={cn(
                "group relative flex items-center justify-between gap-4 w-full px-4 py-3.5 rounded-2xl glass text-left transition-all duration-200",
                !showFeedback && [
                  "hover:border-white/20 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]",
                  "disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-white/5 disabled:hover:border-white/10",
                ],
                isCorrectChoice &&
                  "border-emerald-500/80 bg-emerald-950/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)]",
                isWrongChoice &&
                  "border-rose-500/80 bg-rose-950/40 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.25)]",
                showFeedback && !isCorrectChoice && !isWrongChoice && "opacity-40",
                "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Integrated Number Badge */}
                <div
                  className={cn(
                    "shrink-0 flex items-center justify-center w-8 h-8 rounded-xl font-mono text-xs transition-colors",
                    isCorrectChoice
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : isWrongChoice
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-white/5 border border-white/10 text-white/50 group-hover:text-white/90 group-hover:border-white/20",
                  )}
                >
                  {i + 1}
                </div>

                <div className="font-display text-lg md:text-xl text-white tracking-tight truncate pr-2">
                  {o.name}
                </div>
              </div>

              {/* Feedback status indicator icons */}
              {isCorrectChoice && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="shrink-0 size-6 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 flex items-center justify-center"
                >
                  <span className="text-sm font-bold leading-none">✓</span>
                </motion.div>
              )}
              {isWrongChoice && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="shrink-0 size-6 rounded-full bg-rose-500/20 border border-rose-500/60 text-rose-400 flex items-center justify-center"
                >
                  <span className="text-xs font-bold leading-none">✕</span>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function FlagToType({
  target,
  onSubmit,
}: {
  target: Country;
  onSubmit: (ok: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <motion.div
        key={target.iso3}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring.soft}
      >
        <FlagImage
          iso2={target.iso2}
          alt="Mystery flag"
          size={640}
          className="w-[min(58vw,340px)] lg:w-[min(34vw,400px)] aspect-[3/2] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden"
        />
      </motion.div>
      <div className="w-full max-w-md mx-auto">
        <HardInput target={target} onSubmit={onSubmit} placeholder="Type the country…" />
      </div>
    </div>
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
