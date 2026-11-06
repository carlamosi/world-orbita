import { useEffect } from "react";
import type { AnswerState } from "./useSession";

interface Opts {
  /** Current answer state of the session. */
  answerState: AnswerState;
  /** Whether the session has ended (don't auto-advance past the end). */
  finished: boolean;
  /** Called to advance to the next question. */
  next: () => void;
  /** Optional override; default 1200ms. */
  correctDelayMs?: number;
  /** Used only when `waitAfterMiss` is false. */
  wrongDelayMs?: number;
  /**
   * After a wrong/revealed answer, wait for Next (button, Enter or Space) instead
   * of a timer: the learner needs time to read the correction (and WCAG 2.2.1).
   */
  waitAfterMiss?: boolean;
  /** Allow callers to opt out (e.g. paused, modal open). */
  enabled?: boolean;
}

/**
 * Auto-advances a session shortly after a correct answer. After a miss it waits
 * for the learner: Enter or Space advances (the Next button has focus).
 */
export function useAutoAdvance({
  answerState,
  finished,
  next,
  correctDelayMs = 1200,
  wrongDelayMs = 2800,
  waitAfterMiss = true,
  enabled = true,
}: Opts) {
  useEffect(() => {
    if (!enabled || finished) return;
    if (answerState === "idle") return;
    if (answerState === "correct" || !waitAfterMiss) {
      const delay = answerState === "correct" ? correctDelayMs : wrongDelayMs;
      const id = window.setTimeout(() => next(), delay);
      return () => window.clearTimeout(id);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      // Also cancels the focused Next button's native click, so one key = one next().
      e.preventDefault();
      next();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [answerState, finished, next, correctDelayMs, wrongDelayMs, waitAfterMiss, enabled]);
}
