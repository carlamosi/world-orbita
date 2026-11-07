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
  /** Correct on a card's first slot; `total` is then the distinct card count. */
  firstTryCorrect?: number;
  correct: number;
  total: number;
  /** Session cards now mastered (Review, stability 21+ days). */
  masteredNow?: number;
  /** Cards forgotten 4+ times. */
  trickyItems?: MissedItem[];
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
  firstTryCorrect,
  correct,
  total,
  masteredNow = 0,
  trickyItems = [],
  durationMs = 0,
  isSpeedMode = false,
  qpm,
  missedItems = [],
  hasNextBlock = true,
  onNextBlock,
  onReplay,
}: Props) {
  const [exitStep, setExitStep] = useState<"idle" | "confirm">("idle");

  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const streak = useMemo(() => {
    const activeDays = new Set(sessions.map((s) => dateKey(s.createdAt)));
    activeDays.add(dateKey());
    return currentStreak(activeDays);
  }, [sessions]);

  const firstTry = firstTryCorrect ?? correct;
  const accuracy = total > 0 ? Math.round((firstTry / total) * 100) : 0;
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
                <Badge tone="cyan">{isSpeedMode ? "Run complete" : "Session complete"}</Badge>

                {/* One number: first-try recall (or points in a speed run). The stats row carries the rest. */}
                <div className="mt-5 flex items-baseline justify-center gap-1 font-display tracking-tight">
                  <span className="text-6xl sm:text-7xl text-white text-glow-violet tabular-nums">
                    {isSpeedMode ? (score ?? firstTry) : firstTry}
                  </span>
                  {!isSpeedMode && <span className="text-3xl text-white/30 tabular-nums">/{total}</span>}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
                  {isSpeedMode ? "Points" : "First try"}
                </div>
                {masteredNow > 0 && (
                  <div className="mt-3 text-white/55 text-sm">
                    {masteredNow} now mastered (stable for 21+ days)
                  </div>
                )}
                {/* Key stats row - Accuracy and Time alongside with same visual hierarchy */}
                <div className={`mt-6 grid ${isSpeedMode ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-2.5 font-mono text-[11px] uppercase tracking-wider text-white/55`}>
                  <Stat label="Accuracy" value={`${accuracy}%`} />
                  <Stat label="Time" value={timeFormatted} />
                  <Stat label="Day streak" value={streak} />
                  {isSpeedMode && (
                    <Stat
                      label="Speed"
                      value={`${qpm ?? Math.round((total / Math.max(1, durationMs)) * 60_000)} QPM`}
                    />
                  )}
                </div>

                {/* Missed items list */}
                {missedItems.length > 0 && (
                  <div className="mt-6 text-left">
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 px-1">
                      Missed ({missedItems.length})
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
                )}

                {trickyItems.length > 0 && (
                  <div className="mt-4 text-left">
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 px-1">
                      Tricky ({trickyItems.length}): forgotten 4+ times
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {trickyItems.map((item, idx) => (
                        <span
                          key={item.id ?? idx}
                          className="glass rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-xs text-white border border-amber-400/25"
                        >
                          {item.flagIso2 && (
                            <FlagImage iso2={item.flagIso2} alt="" className="w-5 h-3.5 shrink-0 rounded-[2px]" />
                          )}
                          {item.prompt}
                        </span>
                      ))}
                    </div>
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
