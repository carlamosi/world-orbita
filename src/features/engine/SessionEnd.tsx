import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Badge } from "@/components/ui/orbita-badge";
import { Button } from "@/components/ui/orbita-button";
import { FlagImage } from "@/components/ui/FlagImage";
import { spring } from "@/lib/motion";
import { db } from "@/lib/db/orbita-db";
import { currentStreak, dateKey } from "@/lib/streak";
import type { MissedItem } from "@/features/engine/useSession";

export interface SessionEndProps {
  show: boolean;
  score?: number;
  correct: number;
  total: number;
  wrong?: number;
  bestCombo?: number;
  durationMs?: number;
  masteredCount?: number;
  missedItems?: MissedItem[];
  hasNextBlock?: boolean;
  onNextBlock?: () => void;
  onReplay?: () => void;
  isSpeedMode?: boolean;
  qpm?: number;
}

export function SessionEnd({
  show,
  score = 0,
  correct,
  total,
  wrong: rawWrong,
  durationMs = 0,
  masteredCount: customMasteredCount,
  missedItems = [],
  hasNextBlock = true,
  onNextBlock,
  onReplay,
  isSpeedMode = false,
  qpm,
}: SessionEndProps) {
  // Query sessions from Dexie to compute distinct calendar day streak
  const sessions = useLiveQuery(() => db().gameSessions.toArray(), []) ?? [];
  const activeDays = useMemo(() => {
    const set = new Set(sessions.map((s) => dateKey(s.createdAt)));
    // Include today since the current session just finished
    set.add(dateKey());
    return set;
  }, [sessions]);

  const streak = useMemo(() => currentStreak(activeDays, dateKey()), [activeDays]);

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const seconds = Math.round(durationMs / 100) / 10;
  const masteredCount = customMasteredCount ?? correct;
  const wrongCount = rawWrong ?? missedItems.length;

  const handleNext = onNextBlock ?? onReplay;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 backdrop-blur-md bg-black/60 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={spring.soft}
            className="glass-strong rounded-3xl p-6 sm:p-8 md:p-10 max-w-lg w-full text-center my-auto shadow-[0_25px_70px_-15px_rgba(0,0,0,0.7)] border border-white/10"
          >
            {/* Top Badge & Streak */}
            <div className="flex items-center justify-center gap-2">
              <Badge tone={masteredCount > 0 ? "cyan" : "muted"}>Session Complete</Badge>
              {streak > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-400/10 border border-amber-400/25 text-amber-300">
                  <span>🔥</span>
                  <span>
                    {streak} {streak === 1 ? "day" : "days"} streak
                  </span>
                </span>
              )}
            </div>

            {/* Primary Headline Metric: Learning-relevant Mastery */}
            <div className="mt-5">
              <div className="font-display text-5xl md:text-6xl font-bold text-white tracking-tight text-glow-violet">
                {masteredCount}
              </div>
              <div className="mt-1 text-sm md:text-base text-white/70 font-medium">
                {masteredCount === 1 ? "concept mastered today" : "concepts mastered today"}
              </div>
              <div className="mt-1 text-xs font-mono text-white/40">
                {correct} of {total} correct ({accuracy}%)
              </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="mt-6 grid grid-cols-3 gap-2.5 font-mono text-[11px] uppercase tracking-wider text-white/55">
              <Stat label="Accuracy" value={`${accuracy}%`} />
              <Stat
                label="Consistency"
                value={`${streak}d`}
                highlight={streak >= 3}
              />
              {isSpeedMode ? (
                <Stat label="Speed" value={`${qpm ?? Math.round((total / Math.max(1, durationMs)) * 60000)} QPM`} />
              ) : (
                <Stat label="Score" value={score} />
              )}
            </div>

            {/* In Speed Mode: Show elapsed time */}
            {isSpeedMode && (
              <div className="mt-3 text-xs font-mono text-white/50">
                Elapsed: <span className="text-white font-medium">{seconds}s</span> · Points:{" "}
                <span className="text-[color:var(--cyan)] font-medium">{score}</span>
              </div>
            )}

            {/* Missed Items Section */}
            <div className="mt-6 text-left">
              {missedItems.length > 0 ? (
                <div className="glass rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-white/60 mb-3">
                    <span>Missed Items ({missedItems.length})</span>
                    <span className="text-[10px] text-white/40">Review to reinforce</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
                    {missedItems.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs md:text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          {item.flagIso2 && (
                            <FlagImage
                              iso2={item.flagIso2}
                              alt=""
                              className="w-5 h-3.5 rounded-xs shrink-0 object-cover shadow-sm"
                            />
                          )}
                          <span className="text-white/80 font-medium truncate">{item.prompt}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-medium">
                          <span className="text-white/30">→</span>
                          <span className="text-[color:var(--cyan)] text-glow-cyan">{item.answer}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : wrongCount === 0 ? (
                <div className="glass rounded-2xl p-3.5 text-center text-xs md:text-sm text-[color:var(--neon)] flex items-center justify-center gap-2 border border-[color:var(--neon)]/20 bg-[color:var(--neon)]/5">
                  <span>✨</span>
                  <span className="font-medium">Flawless round! Zero mistakes.</span>
                </div>
              ) : null}
            </div>

            {/* Action Buttons: Next 10 → and Done for today */}
            <div className="mt-8 flex gap-3 justify-center">
              {hasNextBlock && handleNext && (
                <Button onClick={handleNext} className="flex-1">
                  Next 10 →
                </Button>
              )}
              <Link to="/" className={hasNextBlock && handleNext ? "flex-1" : "w-full"}>
                <Button
                  variant={hasNextBlock && handleNext ? "secondary" : "primary"}
                  className="w-full"
                >
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

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="glass rounded-xl py-3 px-2 border border-white/5">
      <div
        className={`font-display text-base normal-case tracking-tight ${
          highlight ? "text-amber-300 font-semibold" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] text-white/45">{label}</div>
    </div>
  );
}
