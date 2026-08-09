import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { p as pickRandomCountries, C as COUNTRIES, s as spring } from './motion-B8-Vl7RP.mjs';
import { P as PromptPill, F as FeedbackBar, S as SessionEnd, c as createSessionStore } from './FeedbackBar-D3XqZG1l.mjs';
import { u as useAutoAdvance } from './useAutoAdvance-Da90vNd_.mjs';
import { u as useSkipHotkey } from './useSkipHotkey-DYRLIO3y.mjs';
import { H as HardInput } from './HardInput-B1PHb7Ws.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import { F as FlagImage } from './FlagImage-X1rCgo2Q.mjs';
import { u as useAnswerHotkeys } from './useAnswerHotkeys-7pgBdxjU.mjs';
import { u as useContinentPref, C as ContinentSelect } from './ContinentSelect-nxtEY6fc.mjs';
import '../_libs/dexie.mjs';
import '../_libs/sonner.mjs';
import { m as motion } from '../_libs/framer-motion.mjs';
import './unlocks-Bp4r3G0f.mjs';
import './orbita-db-Bdp3ClIj.mjs';
import '../_libs/tanstack__react-router.mjs';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import 'node:stream';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import './orbita-button-CKjnWSTu.mjs';
import '../_libs/zustand.mjs';
import './clientId-B0Bcj0A6.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
import '../_libs/clsx.mjs';
import '../_libs/tailwind-merge.mjs';
import './client-CnjuyyaV.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
import '../_libs/radix-ui__react-dropdown-menu.mjs';
import '../_libs/radix-ui__primitive.mjs';
import '../_libs/radix-ui__react-compose-refs.mjs';
import '../_libs/radix-ui__react-context.mjs';
import '../_libs/@radix-ui/react-use-controllable-state+[...].mjs';
import '../_libs/@radix-ui/react-use-layout-effect+[...].mjs';
import '../_libs/radix-ui__react-primitive.mjs';
import '../_libs/radix-ui__react-slot.mjs';
import '../_libs/radix-ui__react-menu.mjs';
import '../_libs/radix-ui__react-collection.mjs';
import '../_libs/radix-ui__react-direction.mjs';
import '../_libs/@radix-ui/react-dismissable-layer+[...].mjs';
import '../_libs/@radix-ui/react-use-callback-ref+[...].mjs';
import '../_libs/@radix-ui/react-use-escape-keydown+[...].mjs';
import '../_libs/radix-ui__react-focus-guards.mjs';
import '../_libs/radix-ui__react-focus-scope.mjs';
import '../_libs/radix-ui__react-popper.mjs';
import '../_libs/floating-ui__react-dom.mjs';
import '../_libs/floating-ui__dom.mjs';
import '../_libs/floating-ui__core.mjs';
import '../_libs/floating-ui__utils.mjs';
import '../_libs/radix-ui__react-arrow.mjs';
import '../_libs/radix-ui__react-use-size.mjs';
import '../_libs/radix-ui__react-portal.mjs';
import '../_libs/radix-ui__react-presence.mjs';
import '../_libs/radix-ui__react-roving-focus.mjs';
import '../_libs/radix-ui__react-id.mjs';
import '../_libs/aria-hidden.mjs';
import '../_libs/react-remove-scroll.mjs';
import '../_libs/react-remove-scroll-bar.mjs';
import '../_libs/react-style-singleton.mjs';
import '../_libs/get-nonce.mjs';
import '../_libs/use-sidecar.mjs';
import '../_libs/use-callback-ref.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';

function SubModeToggle({
  options,
  value,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "glass rounded-full p-1 flex text-[11px] font-mono uppercase tracking-wider whitespace-nowrap",
      role: "group",
      children: options.map(({ value: v, label }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: () => onChange(v),
          "aria-pressed": value === v,
          className: cn(
            "px-3 py-1 rounded-full transition-colors whitespace-nowrap",
            value === v ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
          ),
          children: label
        },
        v
      ))
    }
  );
}

const Globe3D = reactExports.lazy(() => import('./Globe3D-DdTBAHs8.mjs'));
const useNameSession = createSessionStore({ mode: "name", skill: "name" });
const MODE_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "hard", label: "Hard" }
];
function NamePage() {
  const s = useNameSession();
  const [mode, setMode] = reactExports.useState("easy");
  const [continent, setContinent] = useContinentPref();
  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;
  reactExports.useEffect(() => {
    void s.start({ continent: continent === "All" ? void 0 : continent });
  }, [continent]);
  useAutoAdvance({ answerState: s.answerState, finished, next: s.next });
  const onSkip = reactExports.useCallback(() => {
    if (!finished && current && s.answerState === "idle") s.reveal();
  }, [finished, current, s]);
  useSkipHotkey(onSkip);
  const restartWithContinent = reactExports.useCallback(
    (c) => {
      setContinent(c);
    },
    [setContinent]
  );
  const pov = reactExports.useMemo(() => {
    if (!current) return void 0;
    return { lat: current.coordinates[0], lng: current.coordinates[1], altitude: 1.2 };
  }, [current?.iso3, current?.coordinates]);
  const options = reactExports.useMemo(() => {
    if (!current) return [];
    const others = pickRandomCountries(3, /* @__PURE__ */ new Set([current.iso3]));
    return shuffle([current, ...others]);
  }, [current]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative min-h-dvh pt-20", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: /* @__PURE__ */ jsxRuntimeExports.jsx(GlobeFallback, {}), children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Globe3D,
      {
        countries: COUNTRIES,
        highlightIso3: s.answerState === "idle" || s.answerState === "correct" ? current?.iso3 : null,
        revealIso3: s.answerState === "wrong" || s.answerState === "revealed" ? current?.iso3 : null,
        pointOfView: pov,
        activeContinent: continent === "All" ? null : continent
      }
    ) }) }),
    !finished && current && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute top-24 inset-x-0 z-20 flex justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        PromptPill,
        {
          keyId: current.iso3,
          index: s.index,
          total: s.queue.length,
          title: "Name this country"
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute top-24 left-4 md:left-6 z-20 flex flex-col gap-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ContinentSelect, { value: continent, onChange: restartWithContinent }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute top-24 right-4 md:right-6 z-20 flex flex-col gap-2 items-end", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SubModeToggle, { options: MODE_OPTIONS, value: mode, onChange: setMode }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute bottom-8 inset-x-0 z-30 px-4", children: s.answerState === "idle" ? mode === "easy" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        EasyOptions,
        {
          options,
          targetIso3: current.iso3,
          onPick: (iso3) => s.submit(iso3 === current.iso3)
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx(HardInput, { target: current, onSubmit: (ok) => s.submit(ok) }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
        FeedbackBar,
        {
          show: true,
          state: s.answerState,
          title: current.name,
          subtitle: `Capital: ${current.capital ?? "—"}`,
          onNext: () => s.next(),
          onSkip: s.answerState === "wrong" ? () => s.reveal() : void 0,
          hideNext: true
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      SessionEnd,
      {
        show: finished,
        score: s.score,
        correct: s.correct,
        total: s.queue.length,
        wrong: s.wrong,
        bestCombo: s.bestCombo,
        durationMs: (s.endedAt ?? 0) - s.startedAt,
        onReplay: () => s.start({ continent: continent === "All" ? void 0 : continent })
      }
    )
  ] });
}
function EasyOptions({
  options,
  targetIso3,
  onPick
}) {
  const hotkeyItems = reactExports.useMemo(
    () => options.map((o) => ({ id: o.iso3 })),
    [options]
  );
  const onPickById = reactExports.useCallback((id) => onPick(id), [onPick]);
  useAnswerHotkeys(hotkeyItems, onPickById);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: spring.soft,
      className: "max-w-2xl mx-auto grid grid-cols-2 gap-3",
      children: [
        options.map((o, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => onPick(o.iso3),
            className: cn(
              "glass rounded-2xl px-5 py-4 text-left transition-all duration-200",
              "hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-25px_color-mix(in_oklab,var(--violet)_55%,transparent)]",
              "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60"
            ),
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/40", children: i + 1 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-lg text-white tracking-tight", children: o.name })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: o.iso2, alt: o.name, className: "w-12 h-8 shrink-0" })
            ] })
          },
          o.iso3
        )),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "hidden", "data-target": targetIso3 })
      ]
    }
  );
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function GlobeFallback() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-full grid place-items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-40 rounded-full bg-gradient-to-br from-violet/30 to-cyan/20 animate-breathe blur-2xl" }) });
}

const SplitComponent = NamePage;

export { SplitComponent as component };
