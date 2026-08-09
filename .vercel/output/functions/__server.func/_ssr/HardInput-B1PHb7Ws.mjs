import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { s as spring } from './motion-B8-Vl7RP.mjs';
import { m as motion } from '../_libs/framer-motion.mjs';

function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[b.length];
}
function fuzzyMatch(guess, target, alts = []) {
  const g = normalize(guess);
  if (!g) return false;
  const candidates = [target, ...alts].map(normalize).filter(Boolean);
  for (const c of candidates) {
    if (g === c) return true;
    const tol = Math.max(1, Math.floor(c.length / 8));
    if (levenshtein(g, c) <= tol) return true;
  }
  return false;
}
function exactMatch(guess, target, alts = []) {
  const g = normalize(guess);
  if (!g) return false;
  const candidates = [target, ...alts].map(normalize).filter(Boolean);
  return candidates.includes(g);
}

function HardInput({ target, matchTarget, onSubmit, placeholder = "Type the country…" }) {
  const [val, setVal] = reactExports.useState("");
  const ref = reactExports.useRef(null);
  reactExports.useEffect(() => {
    ref.current?.focus();
    setVal("");
  }, [target.iso3]);
  const expectedText = matchTarget ?? target.name;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: spring.soft,
      className: "max-w-md mx-auto glass-strong rounded-2xl p-4 flex items-center gap-3",
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          ref,
          value: val,
          onChange: (e) => {
            const v = e.target.value;
            setVal(v);
            if (exactMatch(v, expectedText)) onSubmit(true);
          },
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (val.trim()) onSubmit(fuzzyMatch(val, expectedText));
            }
          },
          placeholder,
          className: "flex-1 bg-transparent outline-none text-white placeholder:text-white/35 font-display text-lg",
          autoComplete: "off",
          autoCapitalize: "words",
          spellCheck: false
        }
      )
    }
  );
}

export { HardInput as H };
