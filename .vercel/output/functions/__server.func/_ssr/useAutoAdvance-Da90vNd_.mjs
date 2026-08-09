import { r as reactExports } from '../_libs/react.mjs';

function useAutoAdvance({
  answerState,
  finished,
  next,
  correctDelayMs = 900,
  wrongDelayMs = 1500,
  enabled = true
}) {
  reactExports.useEffect(() => {
    if (!enabled || finished) return;
    if (answerState === "idle") return;
    const delay = answerState === "correct" ? correctDelayMs : wrongDelayMs;
    const id = window.setTimeout(() => next(), delay);
    return () => window.clearTimeout(id);
  }, [answerState, finished, next, correctDelayMs, wrongDelayMs, enabled]);
}

export { useAutoAdvance as u };
