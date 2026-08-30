import { useMemo } from "react";
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

export function SessionEnd({
  show,
  score,
  masteredCount,
  correct,
  total,
  durationMs = 0,
  showTime = false,
  isSpeedMode = false,
  qpm,
  missedItems = [],
  hasNextBlock = true,
  onNextBlock,
  onReplay,
}: Props) {
  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const streak = useMemo(() => {
    const activeDays = new Set(sessions.map((s) => dateKey(s.createdAt)));
    activeDays.add(dateKey());
    return currentStreak(activeDays);
  }, [sessions]);

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const effectiveMastered = masteredCount ?? correct;
  const seconds = Math.round(durationMs / 100) / 10;
  const handleNext = onNextBlock ?? onReplay;
  const displayTime = isSpeedMode || showTime;

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
            <div className="flex items-center justify-center gap-2">
              <Badge tone="cyan">{isSpeedMode ? "Run complete" : "Block complete"}</Badge>
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
              {correct} of {total} correct · {accuracy}% accuracy
              {displayTime && ` · ${seconds}s`}
            </div>

            {/* Key stats row */}
            <div className="mt-6 grid grid-cols-3 gap-2.5 font-mono text-[11px] uppercase tracking-wider text-white/55">
              <Stat label="Accuracy" value={`${accuracy}%`} />
              <Stat label="Day Streak" value={`🔥 ${streak}d`} />
              {isSpeedMode ? (
                <Stat
                  label="Speed"
                  value={`${qpm ?? Math.round((total / Math.max(1, durationMs)) * 60_000)} QPM`}
                />
              ) : (
                <Stat label="Missed" value={missedItems.length > 0 ? missedItems.length : "0"} />
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
                          <span className="text-[color:var(--coral)]/85 font-mono text-[11px] shrink-0">
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
              {hasNextBlock && handleNext && (
                <Button onClick={handleNext} className="w-full sm:w-auto font-medium">
                  Next 10 →
                </Button>
              )}
              <Link to="/" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  Done for today
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl py-3">
      <div className="font-display text-base text-white normal-case tracking-tight">
        {value}
      </div>
      <div className="mt-1 text-[10px]">{label}</div>
    </div>
  );
}
