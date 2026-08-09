import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { C as COUNTRIES } from './motion-B8-Vl7RP.mjs';
import { P as PromptPill, F as FeedbackBar, S as SessionEnd, c as createSessionStore } from './FeedbackBar-D3XqZG1l.mjs';
import { u as useAutoAdvance } from './useAutoAdvance-Da90vNd_.mjs';
import { u as useSkipHotkey } from './useSkipHotkey-DYRLIO3y.mjs';
import { s as selectAllForContinent } from './mastery-XPzQDsTf.mjs';
import { u as useContinentPref, C as ContinentSelect } from './ContinentSelect-nxtEY6fc.mjs';
import '../_libs/sonner.mjs';
import '../_libs/dexie.mjs';
import './router-T2jDQtma.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
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
import '../_libs/framer-motion.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/zustand.mjs';
import './unlocks-Bp4r3G0f.mjs';
import './orbita-db-Bdp3ClIj.mjs';
import './orbita-button-CKjnWSTu.mjs';
import './clientId-B0Bcj0A6.mjs';

const Globe3D = reactExports.lazy(() => import('./Globe3D-DdTBAHs8.mjs'));
const useFindSession = createSessionStore({ mode: "find", skill: "location" });
function FindPage() {
  const s = useFindSession();
  const [continent, setContinent] = useContinentPref();
  const [sessionMode, setSessionMode] = reactExports.useState("quick");
  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;
  const continentCount = reactExports.useMemo(() => {
    if (!continent || continent === "All") return COUNTRIES.length;
    return COUNTRIES.filter((c) => c.continent === continent).length;
  }, [continent]);
  const startSession = reactExports.useCallback(
    (c, mode) => {
      if (mode === "complete") {
        const all = selectAllForContinent(c === "All" ? null : c);
        void s.start({ allCountries: all });
      } else {
        void s.start({ continent: c === "All" ? void 0 : c });
      }
    },
    [s]
  );
  reactExports.useEffect(() => {
    startSession(continent, sessionMode);
  }, [continent, sessionMode]);
  useAutoAdvance({
    answerState: s.answerState,
    finished,
    next: s.next
  });
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative min-h-dvh pt-20", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: /* @__PURE__ */ jsxRuntimeExports.jsx(GlobeFallback, {}), children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Globe3D,
      {
        countries: COUNTRIES,
        highlightIso3: s.answerState === "correct" ? current?.iso3 : null,
        revealIso3: s.answerState === "wrong" || s.answerState === "revealed" ? current?.iso3 : null,
        onCountryClick: (iso3) => current && s.answerState === "idle" && s.submit(iso3 === current.iso3),
        disableHoverLabel: true,
        questionKey: current?.iso3 ?? null,
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
          title: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            "Find ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-glow-cyan", children: current.name })
          ] })
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute top-24 left-4 md:left-6 z-20 flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContinentSelect, { value: continent, onChange: restartWithContinent }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "glass rounded-full p-1 flex flex-nowrap items-center gap-0.5 w-fit",
            role: "group",
            "aria-label": "Session mode",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setSessionMode("quick");
                    startSession(continent, "quick");
                  },
                  "aria-pressed": sessionMode === "quick",
                  className: [
                    "shrink-0 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
                    sessionMode === "quick" ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                  ].join(" "),
                  children: "20 Q"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setSessionMode("complete");
                    startSession(continent, "complete");
                  },
                  "aria-pressed": sessionMode === "complete",
                  title: `All ${continentCount} countries in ${continent === "All" ? "the world" : continent}`,
                  className: [
                    "shrink-0 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
                    sessionMode === "complete" ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                  ].join(" "),
                  children: [
                    "All ",
                    continentCount
                  ]
                }
              )
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute bottom-8 inset-x-0 z-30", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        FeedbackBar,
        {
          show: s.answerState !== "idle",
          state: s.answerState === "idle" ? "correct" : s.answerState,
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
        onReplay: () => startSession(continent, sessionMode)
      }
    )
  ] });
}
function GlobeFallback() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-full grid place-items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-40 rounded-full bg-gradient-to-br from-violet/30 to-cyan/20 animate-breathe blur-2xl" }) });
}

const SplitComponent = FindPage;

export { SplitComponent as component };
