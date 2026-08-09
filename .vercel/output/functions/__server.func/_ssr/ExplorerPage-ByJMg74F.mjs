import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { u as useLiveQuery } from '../_libs/dexie-react-hooks.mjs';
import { b as COUNTRY_BY_ISO3, C as COUNTRIES, s as spring, B as Badge } from './motion-B8-Vl7RP.mjs';
import { d as db } from './orbita-db-Bdp3ClIj.mjs';
import { B as Button } from './orbita-button-CKjnWSTu.mjs';
import { F as FlagImage } from './FlagImage-X1rCgo2Q.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import { L as Link } from '../_libs/tanstack__react-router.mjs';
import '../_libs/dexie.mjs';
import '../_libs/sonner.mjs';
import { A as AnimatePresence, m as motion } from '../_libs/framer-motion.mjs';
import { m as Compass, n as ChevronLeft, d as ChevronRight } from '../_libs/lucide-react.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
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
import '../_libs/zustand.mjs';

const EXPEDITIONS = [
  {
    id: "europe-essentials",
    title: "Europe Essentials",
    subtitle: "The continent's largest economies in a single loop.",
    continent: "Europe",
    iso3s: ["GBR", "FRA", "DEU", "ITA", "ESP", "POL", "NLD", "BEL", "SWE", "PRT"]
  },
  {
    id: "europe-microstates",
    title: "Microstates of Europe",
    subtitle: "Tiny sovereign nations tucked between giants.",
    continent: "Europe",
    iso3s: ["VAT", "MCO", "SMR", "LIE", "AND", "MLT", "LUX"]
  },
  {
    id: "africa-capitals",
    title: "Capitals of Africa",
    subtitle: "From Cairo to Cape Town — the continent's seats of power.",
    continent: "Africa",
    iso3s: ["EGY", "MAR", "DZA", "NGA", "ETH", "KEN", "TZA", "ZAF", "GHA", "SEN"]
  },
  {
    id: "asia-giants",
    title: "Asia's Giants",
    subtitle: "The largest, most populous nations of the East.",
    continent: "Asia",
    iso3s: ["CHN", "IND", "JPN", "IDN", "PAK", "BGD", "PHL", "VNM", "THA", "KOR"]
  },
  {
    id: "americas-grand-tour",
    title: "Americas Grand Tour",
    subtitle: "North to South — a hemisphere in ten stops.",
    continent: "Americas",
    iso3s: ["CAN", "USA", "MEX", "GTM", "CRI", "COL", "PER", "BRA", "ARG", "CHL"]
  },
  {
    id: "oceania-archipelagos",
    title: "Oceania Archipelagos",
    subtitle: "Island nations of the Pacific.",
    continent: "Oceania",
    iso3s: ["AUS", "NZL", "PNG", "FJI", "SLB", "VUT", "WSM", "TON"]
  }
];
function findExpedition(id) {
  return EXPEDITIONS.find((e) => e.id === id);
}

function ExpeditionsPanel({ selected, step, onSelect, onStep, onFocusIso3 }) {
  reactExports.useEffect(() => {
    if (!selected) return;
    function onKey(e) {
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || active?.isContentEditable) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onStep(Math.min(selected.iso3s.length - 1, step + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onStep(Math.max(0, step - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, step, onStep]);
  reactExports.useEffect(() => {
    if (!selected) return;
    const iso2 = selected.iso3s[step];
    if (iso2) onFocusIso3(iso2);
  }, [selected, step, onFocusIso3]);
  if (!selected) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        transition: spring.soft,
        className: "glass-strong rounded-3xl p-6 h-full overflow-y-auto",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "violet", children: "Guided Expeditions" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-3 font-display text-2xl text-white tracking-tight text-glow-violet", children: "Pick a journey" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-white/55 text-[13px]", children: "Ordered tours through curated countries. Step through with ← / →." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-5 space-y-2", children: EXPEDITIONS.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              onClick: () => onSelect(e.id),
              className: "w-full text-left glass rounded-2xl p-4 hover:border-white/25 hover:-translate-y-0.5 transition-all",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Compass, { className: "size-4 text-[color:var(--cyan)]" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-base text-white tracking-tight", children: e.title }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-auto font-mono text-[10px] uppercase tracking-wider text-white/40", children: [
                    e.iso3s.length,
                    " stops"
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[12px] text-white/55", children: e.subtitle })
              ]
            },
            e.id
          )) })
        ]
      }
    );
  }
  const iso = selected.iso3s[step];
  const country = iso ? COUNTRY_BY_ISO3.get(iso) : null;
  const atEnd = step >= selected.iso3s.length - 1;
  const atStart = step <= 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      transition: spring.soft,
      className: "glass-strong rounded-3xl p-6 h-full overflow-y-auto",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => onSelect(null),
              className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45 hover:text-white",
              children: "← All expeditions"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-[10px] uppercase tracking-wider text-white/45", children: [
            step + 1,
            " / ",
            selected.iso3s.length
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-3 font-display text-2xl text-white tracking-tight text-glow-violet", children: selected.title }),
        country && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: spring.soft,
            className: "mt-5",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  FlagImage,
                  {
                    iso2: country.iso2,
                    alt: country.name,
                    size: 320,
                    className: "w-24 aspect-[3/2] shrink-0"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "cyan", children: country.continent }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 font-display text-2xl text-white tracking-tight truncate", children: country.name }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 mt-1", children: [
                    "Capital: ",
                    country.capital ?? "—"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-4 text-[13px] text-white/65 leading-relaxed", children: [
                country.subregion ? `${country.subregion} · ` : "",
                "Population ",
                new Intl.NumberFormat("en-US").format(country.population),
                ".",
                country.borders.length > 0 ? ` Shares borders with ${country.borders.length} ${country.borders.length === 1 ? "country" : "countries"}.` : " An island or otherwise without land borders."
              ] })
            ]
          },
          country.iso3
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              size: "sm",
              variant: "secondary",
              disabled: atStart,
              onClick: () => onStep(step - 1),
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "size-4" }),
                " Prev"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", disabled: atEnd, onClick: () => onStep(step + 1), children: [
            "Next ",
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "size-4" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-auto font-mono text-[10px] uppercase tracking-wider text-white/40", children: "← / → keys" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45 mb-2", children: "Itinerary" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1.5", children: selected.iso3s.map((id, i) => {
            const c = COUNTRY_BY_ISO3.get(id);
            if (!c) return null;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: () => onStep(i),
                className: cn(
                  "rounded-full px-2.5 py-1 text-[11px] transition-colors flex items-center gap-1.5",
                  i === step ? "bg-white/15 text-white" : "text-white/55 hover:text-white hover:bg-white/8"
                ),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: c.iso2, alt: c.name, className: "w-4 h-3 rounded-sm" }),
                  c.name
                ]
              },
              id
            );
          }) })
        ] })
      ]
    },
    selected.id
  );
}

const Globe3D = reactExports.lazy(() => import('./Globe3D-DdTBAHs8.mjs'));
const CONTINENTS = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"];
function ExplorerPage() {
  const [layer, setLayer] = reactExports.useState("explore");
  const [selectedIso3, setSelectedIso3] = reactExports.useState(() => {
    if (typeof window === "undefined") return "ESP";
    const saved = window.localStorage.getItem("orbita.explorer.lastIso3");
    return saved && COUNTRY_BY_ISO3.has(saved) ? saved : "ESP";
  });
  const [continent, setContinent] = reactExports.useState("All");
  const [query, setQuery] = reactExports.useState("");
  const [expeditionId, setExpeditionId] = reactExports.useState(null);
  const [expeditionStep, setExpeditionStep] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const l = url.searchParams.get("layer");
    const iso = url.searchParams.get("iso");
    const exp = url.searchParams.get("exp");
    if (l) setLayer(l);
    if (iso && COUNTRY_BY_ISO3.has(iso)) setSelectedIso3(iso);
    if (exp && findExpedition(exp)) {
      setExpeditionId(exp);
      setLayer("expedition");
    }
  }, []);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("layer", layer);
    if (selectedIso3) {
      url.searchParams.set("iso", selectedIso3);
      window.localStorage.setItem("orbita.explorer.lastIso3", selectedIso3);
    } else url.searchParams.delete("iso");
    if (expeditionId) url.searchParams.set("exp", expeditionId);
    else url.searchParams.delete("exp");
    window.history.replaceState({}, "", url.toString());
  }, [layer, selectedIso3, expeditionId]);
  const selected = COUNTRY_BY_ISO3.get(selectedIso3) ?? null;
  const expedition = expeditionId ? findExpedition(expeditionId) ?? null : null;
  const results = reactExports.useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter((c) => {
      if (continent !== "All" && c.continent !== continent) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.capital?.toLowerCase().includes(q))
        return false;
      return true;
    }).slice(0, 60);
  }, [continent, query]);
  const focusIso3 = layer === "expedition" && expedition ? expedition.iso3s[expeditionStep] ?? null : selectedIso3;
  const pov = reactExports.useMemo(() => {
    const iso = focusIso3;
    const c = iso ? COUNTRY_BY_ISO3.get(iso) : null;
    return c ? { lat: c.coordinates[0], lng: c.coordinates[1], altitude: 1.7 } : void 0;
  }, [focusIso3]);
  const handleGlobeClick = reactExports.useCallback(
    (iso3) => {
      setSelectedIso3(iso3);
      if (layer === "explore") setLayer("country");
    },
    [layer]
  );
  const handleExpeditionFocus = reactExports.useCallback((iso3) => {
    setSelectedIso3(iso3);
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-dvh pt-20 pb-6 px-4 lg:px-8 flex flex-col", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "mx-auto w-full max-w-[1440px] flex flex-wrap items-center gap-3 py-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LayerTabs, { value: layer, onChange: setLayer }),
      layer === "explore" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            value: query,
            onChange: (e) => setQuery(e.target.value),
            placeholder: "Search countries or capitals…",
            className: "glass rounded-full px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30 min-w-[200px] flex-1"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "glass rounded-full p-1 hidden md:flex text-[11px] font-mono uppercase tracking-wider", children: CONTINENTS.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setContinent(c),
            className: cn(
              "px-2.5 py-1 rounded-full transition-colors",
              continent === c ? "bg-white/10 text-white" : "text-white/55 hover:text-white"
            ),
            children: c
          },
          c
        )) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            size: "sm",
            variant: "secondary",
            onClick: () => {
              const pool = results.length > 0 ? results : COUNTRIES;
              setSelectedIso3(
                pool[Math.floor(Math.random() * pool.length)].iso3
              );
            },
            children: "Shuffle"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "mx-auto w-full max-w-[1440px] mt-3 grid gap-4 flex-1 min-h-0\r\n          grid-cols-1\r\n          lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative rounded-3xl overflow-hidden border border-white/10 glass min-h-[420px] lg:min-h-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-full" }), children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              Globe3D,
              {
                countries: COUNTRIES,
                highlightIso3: focusIso3 ?? null,
                onCountryClick: handleGlobeClick,
                pointOfView: pov,
                quality: "medium",
                activeContinent: continent === "All" ? null : continent
              }
            ) }),
            layer === "explore" && (query || continent !== "All") && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute bottom-3 left-3 right-3 glass-strong rounded-2xl px-3 py-2 overflow-x-auto z-10", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
              results.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  onClick: () => setSelectedIso3(c.iso3),
                  className: cn(
                    "shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] transition-colors",
                    selectedIso3 === c.iso3 ? "bg-white/15 text-white" : "text-white/65 hover:text-white hover:bg-white/8"
                  ),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: c.iso2, alt: c.name, className: "w-5 h-3.5 rounded-sm" }),
                    c.name
                  ]
                },
                c.iso3
              )),
              results.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-white/45 text-sm px-2 py-1", children: "No matches." })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: "min-h-0 lg:overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full lg:overflow-y-auto pr-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: layer === "expedition" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            ExpeditionsPanel,
            {
              selected: expedition,
              step: expeditionStep,
              onSelect: (id) => {
                setExpeditionId(id);
                setExpeditionStep(0);
              },
              onStep: setExpeditionStep,
              onFocusIso3: handleExpeditionFocus
            },
            "expedition-panel"
          ) : layer === "country" && selected ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            CountryPanel,
            {
              country: selected,
              onSelect: setSelectedIso3
            },
            "country-panel"
          ) : /* @__PURE__ */ jsxRuntimeExports.jsx(ExploreHint, { onPickExpedition: () => setLayer("expedition") }, "hint") }) }) })
        ]
      }
    )
  ] });
}
function LayerTabs({ value, onChange }) {
  const tabs = [
    { id: "explore", label: "Explore" },
    { id: "country", label: "Country" },
    { id: "expedition", label: "Expeditions" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "glass-strong rounded-full p-1 flex text-[11px] font-mono uppercase tracking-wider", children: tabs.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      onClick: () => onChange(t.id),
      className: cn(
        "px-3 py-1.5 rounded-full transition-colors whitespace-nowrap",
        value === t.id ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
      ),
      children: t.label
    },
    t.id
  )) });
}
function ExploreHint({ onPickExpedition }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0 },
      transition: spring.soft,
      className: "glass-strong rounded-3xl p-6",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "cyan", children: "Atlas Mode" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-3 font-display text-2xl text-white tracking-tight text-glow-violet", children: "Free exploration" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-white/55 text-[13px]", children: "Pan and rotate the globe. Click any country to open its intelligence card, or follow a guided expedition." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-5 space-y-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/45", children: "Featured journeys" }),
          EXPEDITIONS.slice(0, 3).map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              onClick: onPickExpedition,
              className: "w-full text-left glass rounded-2xl p-3 hover:border-white/25 transition-all",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-sm text-white tracking-tight", children: e.title }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] text-white/55 mt-0.5", children: e.subtitle })
              ]
            },
            e.id
          ))
        ] })
      ]
    }
  );
}
function CountryPanel({
  country,
  onSelect
}) {
  const row = useLiveQuery(
    () => db().countryProgress.get(country.iso3),
    [country.iso3]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, x: 20, filter: "blur(6px)" },
      animate: { opacity: 1, x: 0, filter: "blur(0)" },
      exit: { opacity: 0, x: 10, filter: "blur(6px)" },
      transition: spring.soft,
      className: "glass-strong rounded-3xl p-6",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            FlagImage,
            {
              iso2: country.iso2,
              alt: country.name,
              size: 640,
              className: "w-28 aspect-[3/2] shrink-0"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "violet", children: country.continent }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-2 font-display text-3xl text-white tracking-tight text-glow-violet truncate", children: country.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-mono text-[11px] uppercase tracking-[0.25em] text-white/45 mt-1", children: [
              country.iso3,
              " · ",
              country.subregion || "—"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-wider text-white/55", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Capital", value: country.capital ?? "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Population", value: fmt(country.population) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Area", value: `${fmt(country.area)} km²` }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Difficulty", value: country.difficulty }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Stat,
            {
              label: "Currencies",
              value: country.currencies.join(", ") || "—",
              className: "col-span-2"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Stat,
            {
              label: "Languages",
              value: country.languages.join(", ") || "—",
              className: "col-span-2"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 mb-2", children: "Your mastery" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: ["name", "flag", "capital", "location"].map((sk) => {
            const v = row?.skills?.[sk]?.confidence ?? 0;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between text-[11px] font-mono uppercase tracking-wider text-white/55", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: sk }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-white", children: [
                  Math.round(v * 100),
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1.5 rounded-full bg-white/8 overflow-hidden mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "h-full rounded-full",
                  style: {
                    width: `${Math.max(2, v * 100)}%`,
                    background: v >= 0.8 ? "var(--neon)" : v >= 0.4 ? "var(--cyan)" : "var(--coral)",
                    boxShadow: v >= 0.8 ? "0 0 12px color-mix(in oklab, var(--neon) 60%, transparent)" : void 0
                  }
                }
              ) })
            ] }, sk);
          }) })
        ] }),
        country.borders.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 mb-2", children: "Neighbours" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1.5", children: country.borders.map((iso) => {
            const n = COUNTRY_BY_ISO3.get(iso);
            if (!n) return null;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: () => onSelect(iso),
                className: "glass rounded-full px-3 py-1 text-[12px] text-white/75 hover:text-white hover:border-white/25 transition-colors flex items-center gap-2",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(FlagImage, { iso2: n.iso2, alt: n.name, className: "w-4 h-3 rounded-sm" }),
                  n.name
                ]
              },
              iso
            );
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-7 flex gap-2 flex-wrap", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/name", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", children: "Practice Name" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/flags", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", variant: "secondary", children: "Flags" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/capitals", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", variant: "secondary", children: "Capitals" }) })
        ] })
      ]
    }
  );
}
function Stat({
  label,
  value,
  className
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn("glass rounded-xl px-3 py-2", className), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px]", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-0.5 font-display text-[14px] text-white normal-case tracking-tight truncate", children: value })
  ] });
}
function fmt(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

export { ExplorerPage as default };
