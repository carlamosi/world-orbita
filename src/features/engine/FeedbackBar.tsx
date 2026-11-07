import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/orbita-button";
import { spring } from "@/lib/motion";
import { useCallback, type ReactNode } from "react";

interface Props {
  show: boolean;
  state: "correct" | "wrong" | "revealed";
  title: ReactNode;
  subtitle?: ReactNode;
  onNext: () => void;
  onSkip?: () => void;
  /** Hide the manual Next button — auto-advance is handling it. */
  hideNext?: boolean;
  /**
   * What the learner picked or typed (null: nothing identifiable). When passed,
   * a miss reads "You chose X · Answer: <title>" so the two can be contrasted.
   */
  chosen?: string | null;
  /** Small flag of the correct answer, on pages that show flags. */
  flag?: ReactNode;
}

export function FeedbackBar({
  show,
  state,
  title,
  subtitle,
  onNext,
  onSkip,
  hideNext,
  chosen,
  flag,
}: Props) {
  const miss = state !== "correct";
  // Focus Next after a miss so Enter/Space continue without the mouse. autoFocus is lost in real
  // browsers (the clicked option is disabled in the same commit), so focus a tick after mount.
  // Stable so a re-render never pulls focus back from another control.
  const focusNext = useCallback(
    (el: HTMLButtonElement | null) => {
      if (el && miss) setTimeout(() => el.isConnected && el.focus(), 0);
    },
    [miss],
  );
  const label = state === "correct" ? "Nailed it" : state === "wrong" ? "Not quite" : "Revealed";
  const answer = (
    <>
      {miss && chosen !== undefined && (chosen ? `You chose ${chosen} · Answer: ` : "Answer: ")}
      {title}
    </>
  );
  return (
    <div>
      {/* Always mounted and text only, so screen readers announce the result and the answer, not the buttons. */}
      <div role="status" aria-live="polite" className="sr-only">
        {show && (
          <>
            {label}. {answer}. {subtitle}
          </>
        )}
      </div>
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={spring.crisp}
            className="px-4 w-full max-w-md mx-auto"
          >
            <div
              className={`glass-strong rounded-2xl px-6 py-4 flex items-center justify-between gap-4 border transition-all duration-300 ${
                state === "correct"
                  ? "border-emerald-500/30 shadow-[0_8px_32px_-4px_rgba(16,185,129,0.18)]"
                  : state === "wrong"
                  ? "border-rose-500/30 shadow-[0_8px_32px_-4px_rgba(244,63,94,0.18)]"
                  : "border-white/10 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.36)]"
              }`}
            >
              <div className="text-left min-w-0 flex-1" aria-hidden="true">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
                  {label}
                </div>
                <div className="font-display text-lg text-white flex items-center gap-2">
                  {flag}
                  <span className="min-w-0">{answer}</span>
                </div>
                {subtitle && <div className="text-[12px] text-white/55">{subtitle}</div>}
              </div>
              {!hideNext && (
                <Button size="sm" onClick={onNext} ref={focusNext} data-feedback-next="">
                  Next →
                </Button>
              )}
            </div>
            {state === "wrong" && onSkip && (
              <button
                onClick={onSkip}
                className="mx-auto block mt-2 text-[11px] font-mono uppercase tracking-wider text-white/40 hover:text-white/70"
              >
                Skip
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
