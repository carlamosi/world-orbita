import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { e as useNavigate, L as Link } from '../_libs/tanstack__react-router.mjs';
import { u as useAuth, c as cn } from './router-T2jDQtma.mjs';
import { B as Button } from './orbita-button-CKjnWSTu.mjs';
import { C as COUNTRIES, f as fadeUp, B as Badge, a as stagger, s as spring } from './motion-B8-Vl7RP.mjs';
import '../_libs/sonner.mjs';
import { u as useScroll, a as useSpring, b as useTransform, m as motion, A as AnimatePresence, c as useMotionValueEvent } from '../_libs/framer-motion.mjs';
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
import '../_libs/zustand.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';

const Card = reactExports.forwardRef(function Card2({ className, interactive, ...props }, ref) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      ref,
      className: cn(
        "glass rounded-2xl p-6 relative overflow-hidden",
        interactive && "transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--violet)_45%,transparent)]",
        className
      ),
      ...props
    }
  );
});

const STORAGE_KEY = "orbita.onboarding.done";
function hasSeenOnboarding() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}
function markOnboardingSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, "1");
}
const STEPS = [
  {
    eyebrow: "Welcome",
    title: "Welcome to ORBITA.",
    body: "Learn the world the way your brain actually remembers.",
    tone: "violet"
  },
  {
    eyebrow: "Atlas",
    title: "A living atlas.",
    body: "Every country becomes part of your personal map.",
    tone: "cyan"
  },
  {
    eyebrow: "Mastery",
    title: "Discover. Repeat. Master.",
    body: "Learn countries through exploration, repetition, and discovery.",
    tone: "neon"
  },
  {
    eyebrow: "Progress",
    title: "Your world, fully mapped.",
    body: "Build a living atlas of everything you've learned.",
    tone: "coral"
  }
];
const TONE_COLOR = {
  violet: "var(--violet)",
  cyan: "var(--cyan)",
  neon: "var(--neon)",
  coral: "var(--coral)"
};
function OnboardingOverlay({ open, onComplete, onSkip }) {
  const [step, setStep] = reactExports.useState(0);
  const { signedIn } = useAuth();
  reactExports.useEffect(() => {
    if (!open) setStep(0);
  }, [open]);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  const accent = TONE_COLOR[current.tone] ?? "var(--violet)";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: open && /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.35 },
      className: "fixed inset-0 z-[100] grid place-items-center px-6",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Welcome to Orbita",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            "aria-hidden": true,
            className: "absolute inset-0",
            style: {
              background: "radial-gradient(circle at 50% 40%, rgba(108,99,255,0.35), rgba(5,5,8,0.92) 60%, #050508 100%)",
              backdropFilter: "blur(18px)"
            }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              markOnboardingSeen();
              onSkip();
            },
            className: "absolute top-6 right-6 z-10 text-[11px] font-mono uppercase tracking-[0.25em] text-white/50 hover:text-white transition-colors",
            children: "Skip →"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, y: 20, scale: 0.98 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: -20 },
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            className: "relative z-10 glass-strong rounded-3xl px-10 py-14 max-w-xl w-full text-center",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative mx-auto mb-10 size-32", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  motion.div,
                  {
                    className: "absolute inset-0 rounded-full",
                    animate: { scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] },
                    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                    style: {
                      background: `radial-gradient(circle at 35% 30%, ${accent}, transparent 70%)`,
                      filter: "blur(8px)"
                    }
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    className: "absolute inset-3 rounded-full border",
                    style: {
                      borderColor: `color-mix(in oklab, ${accent} 50%, transparent)`,
                      background: "radial-gradient(circle at 30% 25%, #2a2f5e 0%, #0b0d1f 60%, #050508 100%)",
                      boxShadow: `0 0 60px -10px ${accent}`
                    }
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "font-mono text-[10px] uppercase tracking-[0.3em]",
                  style: { color: accent },
                  children: [
                    "Step ",
                    step + 1,
                    " / ",
                    STEPS.length,
                    " · ",
                    current.eyebrow
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-3 font-display text-3xl md:text-4xl text-white tracking-tight text-glow-violet", children: current.title }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-4 text-white/65 text-[15px] leading-relaxed max-w-md mx-auto", children: current.body }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-8 flex items-center justify-center gap-1.5", children: STEPS.map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  className: cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === step ? "w-8" : "w-2 bg-white/20"
                  ),
                  style: i === step ? { background: accent, boxShadow: `0 0 12px ${accent}` } : void 0
                },
                i
              )) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 flex flex-col items-center gap-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-center gap-3", children: [
                  step > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "md", variant: "secondary", onClick: () => setStep(step - 1), children: "Back" }),
                  !last ? /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "md", onClick: () => setStep(step + 1), children: "Continue" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      size: "md",
                      onClick: () => {
                        markOnboardingSeen();
                        onComplete();
                      },
                      children: "Begin Your Journey →"
                    }
                  )
                ] }),
                last && !signedIn && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Link,
                  {
                    to: "/auth",
                    search: { mode: "signup" },
                    onClick: () => {
                      markOnboardingSeen();
                      onSkip();
                    },
                    className: "inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.2em] transition-colors hover:opacity-100",
                    style: { color: accent, opacity: 0.85 },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 14 }, children: "💾" }),
                      " Create an account to save your progress →"
                    ]
                  }
                )
              ] })
            ]
          },
          step
        )
      ]
    }
  ) });
}

const MODES = [{
  to: "/find",
  title: "Find It",
  tagline: "Pinpoint a country on the orbital globe.",
  tone: "violet"
}, {
  to: "/name",
  title: "Name It",
  tagline: "A mystery country zooms in. Name it.",
  tone: "cyan"
}, {
  to: "/flags",
  title: "Flags",
  tagline: "Flag to country, country to flag.",
  tone: "neon"
}, {
  to: "/capitals",
  title: "Capitals",
  tagline: "Match the world's seats of power.",
  tone: "coral"
}, {
  to: "/speed",
  title: "Speed Round",
  tagline: "60 seconds. Pure orbital reflexes.",
  tone: "violet"
}, {
  to: "/challenges",
  title: "Daily Quest",
  tagline: "Unlock continents one mastery at a time.",
  tone: "cyan"
}];
function Home() {
  const totalCountries = COUNTRIES.length;
  const navigate = useNavigate();
  const [onboarding, setOnboarding] = reactExports.useState(false);
  const beginOrbit = () => {
    if (hasSeenOnboarding()) {
      void navigate({
        to: "/find"
      });
    } else {
      setOnboarding(true);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(CinematicScroll, { totalCountries, onBegin: beginOrbit }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ModesSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FinalCta, { onBegin: beginOrbit }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Footer, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(OnboardingOverlay, { open: onboarding, onComplete: () => {
      setOnboarding(false);
      void navigate({
        to: "/find"
      });
    }, onSkip: () => {
      setOnboarding(false);
      void navigate({
        to: "/find"
      });
    } })
  ] });
}
function CinematicScroll({
  totalCountries,
  onBegin
}) {
  const ref = reactExports.useRef(null);
  const {
    scrollYProgress
  } = useScroll({
    target: ref,
    offset: ["start start", "end end"]
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 22,
    mass: 0.6
  });
  const globeScale = useTransform(progress, [0, 0.6, 1], [1, 1.35, 1.15]);
  const globeY = useTransform(progress, [0, 1], ["0%", "-12%"]);
  const globeRotate = useTransform(progress, [0, 1], [0, 140]);
  const heroOpacity = useTransform(progress, [0, 0.25], [1, 0]);
  const heroY = useTransform(progress, [0, 0.25], [0, -80]);
  const statsOpacity = useTransform(progress, [0.25, 0.45, 0.7, 0.85], [0, 1, 1, 0]);
  const statsY = useTransform(progress, [0.25, 0.45], [40, 0]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("section", { ref, className: "relative", style: {
    height: "380vh"
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "sticky top-0 h-dvh w-full overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { "aria-hidden": true, style: {
      scale: globeScale,
      y: globeY,
      rotate: globeRotate
    }, className: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CssGlobe, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.div, { style: {
      opacity: heroOpacity,
      y: heroY
    }, className: "relative z-10 h-full flex flex-col items-center justify-center text-center px-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "font-display font-semibold tracking-[-0.03em] text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.95] text-white text-glow-violet", children: [
        "Master every corner",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bg-gradient-to-r from-[#a5a0ff] via-white to-[#6ee7ff] bg-clip-text text-transparent", children: "of the world." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-6 max-w-xl text-[15px] md:text-base text-white/65 leading-relaxed", children: "195 countries. Every capital. Every flag. All yours — explored from orbit through a living, atmospheric atlas." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-10 flex flex-wrap gap-3 justify-center", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "lg", onClick: onBegin, children: "Begin orbit →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/explorer", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "secondary", size: "lg", children: "Explore the atlas" }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-10 text-[11px] uppercase tracking-[0.25em] text-white/35 font-mono", children: "Scroll to enter the orbit" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { style: {
      opacity: statsOpacity,
      y: statsY
    }, className: "absolute inset-0 z-[5] flex items-center justify-center pointer-events-none", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-4 md:gap-6 w-[min(92vw,820px)]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Countries", value: totalCountries, tone: "violet" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Continents", value: 7, tone: "cyan" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Capitals", value: 195, tone: "neon" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { label: "Flag combos", value: 1e3, suffix: "+", tone: "coral" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#050508] z-30 pointer-events-none" })
  ] }) });
}
function CssGlobe() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative size-[min(78vh,820px)] aspect-square", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-[-12%] rounded-full", style: {
      background: "radial-gradient(circle at 35% 35%, rgba(108,99,255,0.45), transparent 55%), radial-gradient(circle at 70% 70%, rgba(0,212,255,0.35), transparent 55%)",
      filter: "blur(40px)"
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute inset-0 rounded-full overflow-hidden", style: {
      background: "radial-gradient(circle at 30% 25%, #2a2f5e 0%, #0b0d1f 55%, #050508 100%)",
      boxShadow: "inset -40px -40px 120px rgba(0,0,0,0.85), inset 30px 30px 80px rgba(108,99,255,0.25), 0 0 120px -10px rgba(0,212,255,0.35)"
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 opacity-50", style: {
        background: "radial-gradient(40% 30% at 30% 40%, rgba(0,255,178,0.18), transparent 60%), radial-gradient(35% 25% at 65% 55%, rgba(108,99,255,0.25), transparent 60%), radial-gradient(25% 18% at 50% 75%, rgba(0,212,255,0.18), transparent 60%)",
        mixBlendMode: "screen"
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "absolute inset-0 size-full opacity-25", viewBox: "0 0 100 100", "aria-hidden": true, children: [
        Array.from({
          length: 7
        }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("ellipse", { cx: "50", cy: "50", rx: "50", ry: 6 + i * 6, fill: "none", stroke: "#9ea7ff", strokeWidth: "0.15" }, `lat-${i}`)),
        Array.from({
          length: 9
        }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("ellipse", { cx: "50", cy: "50", rx: 4 + i * 5, ry: "50", fill: "none", stroke: "#9ea7ff", strokeWidth: "0.15" }, `lng-${i}`))
      ] }),
      [["18%", "32%"], ["62%", "44%"], ["44%", "70%"], ["72%", "28%"], ["28%", "60%"]].map(([l, t], i) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute size-1.5 rounded-full bg-cyan animate-pulse-glow", style: {
        left: l,
        top: t,
        animationDelay: `${i * 0.4}s`
      } }, i))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 rounded-full pointer-events-none", style: {
      boxShadow: "inset 0 0 1px rgba(255,255,255,0.4), inset 0 0 40px rgba(0,212,255,0.15)"
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-[-6%] rounded-full border border-white/10", style: {
      transform: "rotate3d(1,0.4,0,72deg)"
    } })
  ] });
}
function StatCard({
  label,
  value,
  tone,
  suffix = ""
}) {
  const [v, setV] = reactExports.useState(0);
  const {
    scrollYProgress
  } = useScroll();
  useMotionValueEvent(scrollYProgress, "change", () => {
    setV((prev) => prev < value ? Math.min(value, prev + Math.ceil(value / 30)) : value);
  });
  const colorMap = {
    violet: "var(--violet)",
    cyan: "var(--cyan)",
    neon: "var(--neon)",
    coral: "var(--coral)"
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "text-center p-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-display font-semibold text-5xl md:text-6xl tracking-tight", style: {
      color: colorMap[tone],
      textShadow: `0 0 32px ${colorMap[tone]}55`
    }, children: [
      v,
      suffix
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/55", children: label })
  ] });
}
function ModesSection() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "relative py-32 px-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-6xl mx-auto", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.div, { variants: stagger(0.1, 0.08), initial: "hidden", whileInView: "show", viewport: {
      once: true,
      margin: "-80px"
    }, className: "text-center mb-16", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { variants: fadeUp, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: "violet", children: "Modes" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.h2, { variants: fadeUp, className: "mt-5 font-display text-4xl md:text-6xl font-semibold tracking-tight text-white", children: [
        "Six orbits.",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-white/55", children: "One mastery." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { variants: stagger(0.05, 0.08), initial: "hidden", whileInView: "show", viewport: {
      once: true,
      margin: "-60px"
    }, className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: MODES.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { variants: fadeUp, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: m.to, className: "block group", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { interactive: true, className: "h-48 flex flex-col justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { tone: m.tone, children: m.tone === "coral" ? "Daily" : "Mode" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-display text-2xl text-white tracking-tight", children: m.title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-white/55", children: m.tagline })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none", style: {
        background: "radial-gradient(400px 200px at var(--mx,50%) var(--my,50%), rgba(108,99,255,0.18), transparent 60%)"
      } })
    ] }) }) }, m.to)) })
  ] }) });
}
function FinalCta({
  onBegin
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "relative py-40 px-6 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "aria-hidden": true, className: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[700px] rounded-full pointer-events-none", style: {
      background: "radial-gradient(circle, rgba(108,99,255,0.28) 0%, transparent 60%)",
      filter: "blur(40px)"
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.div, { initial: {
      opacity: 0,
      y: 30
    }, whileInView: {
      opacity: 1,
      y: 0
    }, viewport: {
      once: true
    }, transition: spring.soft, className: "relative z-10 max-w-3xl mx-auto", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "font-display font-semibold text-5xl md:text-7xl tracking-[-0.03em] text-white text-glow-violet", children: [
        "Your world.",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bg-gradient-to-r from-[#a5a0ff] to-[#6ee7ff] bg-clip-text text-transparent", children: "Fully explored." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-8 text-white/55 text-lg max-w-xl mx-auto", children: "Step into the orbit. The atlas is waiting." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-12", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "lg", className: "animate-pulse-glow", onClick: onBegin, children: "Enter the orbit →" }) })
    ] })
  ] });
}
function Footer() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("footer", { className: "relative z-10 py-12 px-6 text-center text-[11px] uppercase tracking-[0.25em] text-white/30 font-mono border-t border-white/5", children: [
    "Orbita · Cinematic Geography · ",
    (/* @__PURE__ */ new Date()).getFullYear()
  ] });
}

export { Home as component };
