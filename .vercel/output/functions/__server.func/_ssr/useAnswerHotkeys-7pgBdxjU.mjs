import { r as reactExports } from '../_libs/react.mjs';

function useAnswerHotkeys(options, onPick, enabled = true) {
  reactExports.useEffect(() => {
    if (!enabled || !options || options.length === 0) return;
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable)
          return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > Math.min(9, options.length)) return;
      e.preventDefault();
      onPick(options[n - 1].id);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [options, onPick, enabled]);
}

export { useAnswerHotkeys as u };
