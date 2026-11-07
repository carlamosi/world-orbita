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
  /** Delay after a wrong/revealed answer: long enough to see the correction (and the globe fly to it). */
  wrongDelayMs?: number;
  /** Allow callers to opt out (e.g. paused, modal open). */
  enabled?: boolean;
}

/**
 * Auto-advances a session after every answer. After a miss, Enter or Space
 * advances early (the Next button, when shown, has focus).
 */
export function useAutoAdvance({
  answerState,
  finished,
  next,
  correctDelayMs = 1200,
  wrongDelayMs = 2500,
  enabled = true,
}: Opts) {
  useEffect(() => {
    if (!enabled || finished) return;
    if (answerState === "idle") return;
    const miss = answerState !== "correct";
    const id = window.setTimeout(() => next(), miss ? wrongDelayMs : correctDelayMs);
    if (!miss) return () => window.clearTimeout(id);
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // Any other focused control (Skip, links, menus) keeps its own Enter/Space.
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && !active.hasAttribute("data-feedback-next")) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      // Also cancels the focused Next button's native click, so one key = one next().
      e.preventDefault();
      window.clearTimeout(id);
      next();
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [answerState, finished, next, correctDelayMs, wrongDelayMs, enabled]);
}
