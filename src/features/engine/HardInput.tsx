import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "@/lib/motion";
import { exactMatch, fuzzyMatch, isPrefixOfOther } from "@/lib/fuzzy";
import { answerNames, type NameKind } from "@/lib/answerNames";
import { cn } from "@/lib/utils";

export interface HardInputTarget {
  name: string;
  id?: string;
  iso3?: string;
  capital?: string | null;
  /** Spain entities carry an alternative official name. */
  nameAlt?: string;
  capitalId?: string;
}

interface Props {
  target: HardInputTarget;
  matchTarget?: string;
  /** What kind of name is typed; drives alternative names and the other-entity checks. */
  kind: NameKind;
  answerState?: "idle" | "correct" | "wrong" | "revealed";
  /** `exact` is false when Enter accepted a typo through the fuzzy matcher; `typed` is the text sent with Enter. */
  onSubmit: (ok: boolean, exact?: boolean, typed?: string) => void;
  placeholder?: string;
}

/**
 * Shared typing surface for Name Hard, Flags Hard, Capitals Hard, and typing modes.
 * - No Submit button.
 * - Instant validation on every keystroke via `exactMatch` (correct => submit).
 * - Enter still works as a fallback (uses `fuzzyMatch` to be forgiving).
 * - When answered, transitions smoothly to green (correct) or red (incorrect) while keeping typed answer visible.
 * - Enter on an empty field means "I don't know": graded wrong, the answer card shows the answer.
 */
export function HardInput({
  target,
  matchTarget,
  kind,
  answerState = "idle",
  onSubmit,
  placeholder = "Type the country…",
}: Props) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const targetKey = target.id ?? target.iso3 ?? target.name;
  const isAnswered = answerState !== "idle";
  const isCorrect = answerState === "correct";
  const isWrong = answerState === "wrong" || answerState === "revealed";

  const expectedText = matchTarget ?? target.name;
  const { alts, others } = answerNames(kind, target);

  // Re-focus and clear when target changes
  useEffect(() => {
    ref.current?.focus();
    setVal("");
  }, [targetKey]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-3 pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={
          isCorrect
            ? { opacity: 1, y: 0, scale: [1, 1.02, 1] }
            : isWrong
            ? { opacity: 1, y: 0, x: [0, -4, 4, -2, 2, 0] }
            : { opacity: 1, y: 0 }
        }
        // Springs take only two keyframes: the shake and pulse need a tween, or framer throws and freezes the page.
        transition={{ ...spring.soft, x: { duration: 0.35 }, scale: { duration: 0.3 } }}
        className={cn(
          "w-full glass-strong rounded-2xl p-4 flex items-center justify-between gap-3 border transition-all duration-300",
          !isAnswered && "border-white/10 focus-within:border-white/25",
          isCorrect &&
            "border-emerald-500/40 bg-emerald-950/40 text-emerald-100 shadow-[0_0_25px_-5px_rgba(16,185,129,0.3)]",
          isWrong &&
            "border-rose-500/40 bg-rose-950/40 text-rose-100 shadow-[0_0_25px_-5px_rgba(244,63,94,0.3)]",
        )}
      >
        <input
          ref={ref}
          value={val}
          disabled={isAnswered}
          onChange={(e) => {
            if (isAnswered) return;
            const v = e.target.value;
            setVal(v);
            // Hold auto-submit while a longer real name is still possible (Niger vs Nigeria).
            if (exactMatch(v, expectedText, alts) && !isPrefixOfOther(v, others)) onSubmit(true, true);
          }}
          onKeyDown={(e) => {
            if (isAnswered) return;
            if (e.key === "Enter") {
              e.preventDefault();
              const typed = val.trim();
              if (!typed) onSubmit(false, false, "");
              else onSubmit(fuzzyMatch(val, expectedText, alts, others), exactMatch(val, expectedText, alts), typed);
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-white placeholder:text-white/35 font-display text-lg disabled:opacity-90"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
        />

        {/* State Badge Icon */}
        <AnimatePresence>
          {isCorrect && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="size-7 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0"
            >
              <span className="text-sm font-bold leading-none">✓</span>
            </motion.div>
          )}
          {isWrong && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="size-7 rounded-full bg-rose-500/20 border border-rose-500/60 text-rose-400 flex items-center justify-center shrink-0"
            >
              <span className="text-xs font-bold leading-none">✕</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}
