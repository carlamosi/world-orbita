import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { p as pickRandomCountries, s as spring } from './motion-B8-Vl7RP.mjs';
import { P as PromptPill, F as FeedbackBar, S as SessionEnd, c as createSessionStore } from './FeedbackBar-D3XqZG1l.mjs';
import { u as useAutoAdvance } from './useAutoAdvance-Da90vNd_.mjs';
import { g as getPref, s as setPref, u as useSkipHotkey } from './useSkipHotkey-DYRLIO3y.mjs';
import { H as HardInput } from './HardInput-B1PHb7Ws.mjs';
import { M as ModeDropdown } from './ModeDropdown-CaWTpN8j.mjs';
import { F as FlagImage } from './FlagImage-X1rCgo2Q.mjs';
import { u as useAnswerHotkeys } from './useAnswerHotkeys-7pgBdxjU.mjs';
import { u as useContinentPref, C as ContinentSelect } from './ContinentSelect-nxtEY6fc.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import '../_libs/dexie.mjs';
import '../_libs/sonner.mjs';
import { m as motion } from '../_libs/framer-motion.mjs';
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
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/zustand.mjs';
import './unlocks-Bp4r3G0f.mjs';
import './orbita-db-Bdp3ClIj.mjs';
import './orbita-button-CKjnWSTu.mjs';
import './clientId-B0Bcj0A6.mjs';

const useFlagSession = createSessionStore({ mode: "flag", skill: "flag" });
const SUB_MODE_OPTIONS = [
  { value: "flagToCountry", label: "Flag → Country" },
  { value: "countryToFlag", label: "Country → Flag" },
  { value: "flagToType", label: "Flag → Type" }
];
function FlagsPage() {
  const s = useFlagSession();
  const [sub, setSub] = reactExports.useState("flagToCountry");
  const [continent, setContinent] = useContinentPref();
  const current = s.queue[s.index] ?? null;
  const finished = s.endedAt !== null;
  reactExports.useEffect(() => {
    getPref("flags.sub").then((v) => v && setSub(v));
  }, []);
  reactExports.useEffect(() => {
    setPref("flags.sub", sub);
  }, [sub]);
  reactExports.useEffect(() => {
    void s.start({ continent: continent === "All" ? void 0 : continent });
  }, [continent, sub]);
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
  const options = reactExports.useMemo(() => {
    if (!current) return [];
    const distractors = pickRandomCountries(sub === "flagToCountry" ? 3 : 5, /* @__PURE__ */ new Set([current.iso3]));
    return shuffle([current, ...distractors]);
  }, [current, sub]);
  const hotkeyItems = reactExports.useMemo(
    () => s.answerState === "idle" && sub !== "flagToType" ? options.map((o) => ({ id: o.iso3 })) : [],
    [options, s.answerState, sub]
  );
  const onHotkey = reactExports.useCallback(
    (id) => current && s.submit(id === current.iso3),
    [current, s]
  );
  useAnswerHotkeys(hotkeyItems, onHotkey);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative min-h-dvh pt-20 flex flex-col items-center", children: [
    !finished && current && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-5xl mx-auto px-4 md:px-6 mb-4 z-20 flex items-center justify-between gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContinentSelect, { value: continent, onChange: restartWithContinent }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ModeDropdown,
          {
            options: SUB_MODE_OPTIONS,
            value: sub,
            onChange: setSub
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 w-full flex flex-col items-center px-4 md:px-6 pb-32 max-w-5xl gap-6 md:gap-8", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PromptPill,
          {
            keyId: `${sub}-${current.iso3}`,
            index: s.index,
            total: s.queue.length,
            title: sub === "flagToCountry" ? "Which country owns this flag?" : sub === "countryToFlag" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              "Find the flag of ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-glow-cyan", children: current.name })
            ] }) : "Name this flag"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-full flex justify-center", children: sub === "flagToCountry" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          FlagToCountry,
          {
            target: current,
            options,
            disabled: s.answerState !== "idle",
            onPick: (iso3) => s.submit(iso3 === current.iso3)
          }
        ) : sub === "countryToFlag" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          CountryToFlag,
          {
            target: current,
            options,
            disabled: s.answerState !== "idle",
            onPick: (iso3) => s.submit(iso3 === current.iso3)
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
          FlagToType,
          {
            target: current,
            onSubmit: (ok) => s.submit(ok)
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed bottom-0 inset-x-0 pb-6 px-4 md:px-6 z-30 pointer-events-none", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        FeedbackBar,
        {
          show: s.answerState !== "idle",
          state: s.answerState,
          title: current.name,
          subtitle: `Capital: ${current.capital ?? "—"}`,
          onNext: () => s.next(),
          onSkip: s.answerState === "wrong" ? () => s.reveal() : void 0,
          hideNext: true
        }
      ) }) })
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
function FlagToCountry({
  target,
  options,
  disabled,
  onPick
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-stretch", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.div,
      {
        initial: { opacity: 0, scale: 0.92, y: 16 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: spring.soft,
        className: "flex items-center justify-center",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          FlagImage,
          {
            iso2: target.iso2,
            alt: "Mystery flag",
            size: 640,
            className: "w-full max-w-[480px] h-auto aspect-[3/2] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden"
          }
        )
      },
      target.iso3
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col justify-center gap-3 w-full", children: options.map((o, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => onPick(o.iso3),
        disabled,
        className: cn(
          "group relative flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl glass text-left transition-all duration-200",
          "hover:border-white/20 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]",
          "disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-white/5 disabled:hover:border-white/10",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60"
        ),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-white/50 font-mono text-xs group-hover:text-white/90 group-hover:border-white/20 transition-colors", children: i + 1 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-lg md:text-xl text-white tracking-tight truncate pr-2", children: o.name })
        ]
      },
      o.iso3
    )) })
  ] });
}
function CountryToFlag({
  target,
  options,
  disabled,
  onPick
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto w-full", children: options.map((o) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "button",
    {
      onClick: () => onPick(o.iso3),
      disabled,
      className: cn(
        "group relative aspect-[3/2] rounded-2xl overflow-hidden transition-transform duration-200",
        "hover:scale-[1.03] disabled:opacity-60 disabled:hover:scale-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
        "shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]",
        o.iso3 === target.iso3 && "ring-2 ring-transparent"
      ),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: o.iso2, alt: o.name, className: "absolute inset-0 rounded-2xl overflow-hidden" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" })
      ]
    },
    o.iso3
  )) });
}
function FlagToType({
  target,
  onSubmit
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-6 w-full", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.div,
      {
        initial: { opacity: 0, scale: 0.92, y: 16 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: spring.soft,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          FlagImage,
          {
            iso2: target.iso2,
            alt: "Mystery flag",
            size: 640,
            className: "w-[min(58vw,340px)] lg:w-[min(34vw,400px)] aspect-[3/2] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden"
          }
        )
      },
      target.iso3
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-full max-w-md mx-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HardInput, { target, onSubmit, placeholder: "Type the country…" }) })
  ] });
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SplitComponent = FlagsPage;

export { SplitComponent as component };
