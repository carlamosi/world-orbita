import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/orbita-button";
import { spring } from "@/lib/motion";
import { useCallback, type ReactNode } from "react";
import { Check, X } from "lucide-react";

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
  /** Announce to screen readers only: the page shows the result itself (the globe). */
  srOnly?: boolean;
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
  srOnly,
}: Props) {
  const miss = state !== "correct";
  // A hit is already clear from the sound and the green answer: no card for it.
  const visible = show && miss && !srOnly;
  // Focus Next after a miss so Enter/Space continue without the mouse. autoFocus is lost in real
  // browsers (the clicked option is disabled in the same commit), so focus a tick after mount.
  // Stable so a re-render never pulls focus back from another control.
  const focusNext = useCallback(
    (el: HTMLButtonElement | null) => {
      if (el && miss) setTimeout(() => el.isConnected && el.focus(), 0);
    },
    [miss],
  );
  // Screen readers only: the card itself shows the result through its two rows, with no label.
  const label = state === "correct" ? "Correct" : "Incorrect";
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
        {visible && (
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={spring.crisp}
            className="px-4 w-full max-w-md mx-auto"
          >
            <div className="glass-strong rounded-2xl pl-5 pr-3 py-3.5 flex items-center gap-4 border border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
              <div className="text-left min-w-0 flex-1 space-y-1.5" aria-hidden="true">
                {/* What was picked: quiet, struck through. Nothing when the learner did not answer. */}
                {chosen && (
                  <div className="flex items-center gap-2.5 text-sm text-white/45">
                    <Mark tone="wrong" />
                    <span className="truncate line-through decoration-rose-400/70">{chosen}</span>
                  </div>
                )}
                {/* The answer carries the weight. */}
                <div className="flex items-center gap-2.5">
                  <Mark tone="right" />
                  {flag}
                  <span className="font-display text-lg leading-tight text-white truncate">{title}</span>
                </div>
                {subtitle && <div className="pl-[30px] text-[12px] leading-snug text-white/45">{subtitle}</div>}
              </div>
              {!hideNext && (
                <Button size="sm" variant="secondary" onClick={onNext} ref={focusNext} data-feedback-next="" className="shrink-0">
                  Next
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

function Mark({ tone }: { tone: "right" | "wrong" }) {
  const Icon = tone === "right" ? Check : X;
  return (
    <span
      className={`size-5 shrink-0 rounded-full grid place-items-center border ${
        tone === "right"
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
          : "border-rose-400/35 bg-rose-400/10 text-rose-300"
      }`}
    >
      <Icon className="size-3" strokeWidth={2.75} />
    </span>
  );
}
