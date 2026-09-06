import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/orbita-badge";
import { Button } from "@/components/ui/orbita-button";
import { FlagImage } from "@/components/ui/FlagImage";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/orbita-db";
import { dateKey, currentStreak } from "@/lib/streak";
import { spring } from "@/lib/motion";

export interface MissedItem {
  id?: string;
  label?: string;
  prompt?: string;
  detail?: string;
  answer?: string;
  iso2?: string;
  flagIso2?: string;
  subMode?: string;
}

interface Props {
  show: boolean;
  score?: number;
  masteredCount?: number;
  correct: number;
  total: number;
  wrong?: number;
  bestCombo?: number;
  durationMs?: number;
  showTime?: boolean;
  isSpeedMode?: boolean;
  qpm?: number;
  missedItems?: MissedItem[];
  hasNextBlock?: boolean;
  onNextBlock?: () => void;
  onReplay?: () => void;
}

function formatSessionTime(durationMs: number): string {
  if (!durationMs || durationMs <= 0) return "0s";
  const totalSec = Math.round(durationMs / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const remSec = totalSec % 60;
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
}

export function SessionEnd({
  show,
  score,
  masteredCount,
  correct,
  total,
  durationMs = 0,
  isSpeedMode = false,
  qpm,
  missedItems = [],
  hasNextBlock = true,
  onNextBlock,
  onReplay,
}: Props) {
  const [exitStep, setExitStep] = useState<"idle" | "confirm" | "motivate">("idle");

  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const streak = useMemo(() => {
    const activeDays = new Set(sessions.map((s) => dateKey(s.createdAt)));
    activeDays.add(dateKey());
    return currentStreak(activeDays);
  }, [sessions]);

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const effectiveMastered = masteredCount ?? correct;
  const timeFormatted = formatSessionTime(durationMs);
  const handleNext = () => {
    setExitStep("idle");
    if (onNextBlock) onNextBlock();
    else if (onReplay) onReplay();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 backdrop-blur-md bg-black/60 overflow-y-auto py-8"
        >
          <motion.div
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={spring.soft}
            className="glass-strong rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center my-auto border border-white/15 shadow-2xl"
          >
            {exitStep === "idle" && (
              <motion.div
                key="summary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <Badge tone="cyan">{isSpeedMode ? "Run Complete" : "Session Complete"}</Badge>
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    🔥 {streak} {streak === 1 ? "day streak" : "day streak"}
                  </span>
                </div>

                {/* Headline learning-relevant metric */}
                <div className="mt-4 font-display text-4xl sm:text-5xl text-white tracking-tight text-glow-violet">
                  {isSpeedMode ? (
                    <>
                      {score ?? effectiveMastered}{" "}
                      <span className="text-[color:var(--cyan)] text-2xl font-sans font-normal">pts</span>
                    </>
                  ) : (
                    <>
                      {effectiveMastered}{" "}
                      <span className="text-[color:var(--cyan)] text-2xl font-sans font-normal">mastered</span>
                    </>
                  )}
                </div>
                <div className="mt-2 text-white/55 text-sm">
                  {correct} of {total} correct ({accuracy}%)
                </div>

                {/* Key stats row - Accuracy and Time alongside with same visual hierarchy */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px] uppercase tracking-wider text-white/55">
                  <Stat label="Accuracy" value={`${accuracy}%`} />
                  <Stat label="Time" value={timeFormatted} />
                  <Stat label="Streak" value={`🔥 ${streak}d`} />
                  {isSpeedMode ? (
                    <Stat
                      label="Speed"
                      value={`${qpm ?? Math.round((total / Math.max(1, durationMs)) * 60_000)} QPM`}
                    />
                  ) : (
                    <Stat label="Score" value={score ?? effectiveMastered} />
                  )}
                </div>

                {/* Missed items list */}
                {missedItems.length > 0 ? (
                  <div className="mt-6 text-left">
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 px-1">
                      Missed Items ({missedItems.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {missedItems.map((item, idx) => {
                        const flagCode = item.flagIso2 ?? item.iso2;
                        const title = item.prompt ?? item.label ?? "";
                        const detail = item.answer ?? item.detail ?? "";
                        return (
                          <div
                            key={item.id ?? idx}
                            className="glass rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs border border-white/10"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {flagCode && (
                                <FlagImage
                                  iso2={flagCode}
                                  alt=""
                                  className="w-5 h-3.5 shrink-0 rounded-[2px]"
                                />
                              )}
                              <span className="text-white font-medium truncate">{title}</span>
                            </div>
                            {detail && (
                              <span className="text-[color:var(--cyan)] font-mono text-[11px] shrink-0">
                                {detail}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 p-3 rounded-2xl bg-[color:var(--neon)]/10 border border-[color:var(--neon)]/25 text-[color:var(--neon)] text-xs font-mono">
                    ✨ Flawless round! All {total} items answered correctly.
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  {hasNextBlock && (onNextBlock || onReplay) && (
                    <Button onClick={handleNext} className="w-full sm:w-auto flex-1 font-medium">
                      Next 10 →
                    </Button>
                  )}
                  <Button
                    variant={hasNextBlock && (onNextBlock || onReplay) ? "secondary" : "primary"}
                    onClick={() => setExitStep("confirm")}
                    className="w-full sm:w-auto flex-1"
                  >
                    Done for today
                  </Button>
                </div>
              </motion.div>
            )}

            {exitStep === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring.soft}
                className="py-4"
              >
                <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-xl">
                  🚀
                </div>
                <h3 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Stop studying for today?
                </h3>
                <p className="mt-2 text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
                  Consistent practice strengthens long-term memory retention. Ready to wrap up?
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={handleNext} className="flex-1 font-medium">
                    Keep studying
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setExitStep("motivate")}
                    className="flex-1"
                  >
                    Finish for today
                  </Button>
                </div>
              </motion.div>
            )}

            {exitStep === "motivate" && (
              <motion.div
                key="motivate"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring.soft}
                className="py-4"
              >
                <div className="size-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-4 text-xl">
                  ✨
                </div>
                <h3 className="font-display text-2xl font-semibold text-white tracking-tight leading-snug">
                  Hey… but don't you want to see a smile on your James exam? 😊
                </h3>
                <p className="mt-2 text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
                  Every question you answer today builds unbreakable mastery.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={handleNext} className="flex-1 font-medium">
                    Keep studying
                  </Button>
                  <Link to="/" className="flex-1">
                    <Button variant="secondary" className="w-full">
                      Finish for today
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl py-3 border border-white/5">
      <div className="font-display text-base text-white normal-case tracking-tight">
        {value}
      </div>
      <div className="mt-1 text-[10px] text-white/45">{label}</div>
    </div>
  );
}
