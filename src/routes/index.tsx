import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/orbita-button";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { COUNTRIES } from "@/lib/countries";
import { useAuth } from "@/hooks/useAuth";
import { useDueTodayCount } from "@/hooks/useDueTodayCount";
import { OnboardingOverlay, hasSeenOnboarding } from "@/features/onboarding/OnboardingOverlay";
import { LiveQuestion } from "@/features/home/LiveQuestion";
import { ContinentProgress } from "@/features/home/ContinentProgress";
import { Reveal } from "@/features/home/Reveal";
import { useCountryMastery } from "@/features/home/mastery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbita | Learn every country" },
      {
        name: "description",
        content:
          "A geography trainer for countries, capitals and flags. Short questions on a globe, scheduled so you review each one just before you forget it.",
      },
      { property: "og:title", content: "Orbita | Learn every country" },
      {
        property: "og:description",
        content: "Fill in the whole map. Spaced repetition for countries, capitals and flags.",
      },
    ],
  }),
  component: Home,
});

const MODES = [
  { to: "/find", title: "Find It", tagline: "Point to the country on the globe." },
  { to: "/name", title: "Name It", tagline: "A country zooms into view. Name it." },
  { to: "/flags", title: "Flags", tagline: "Match flags to countries, Easy or Hard." },
  { to: "/capitals", title: "Capitals", tagline: "Pair each country with its capital." },
  { to: "/speed", title: "Speed Round", tagline: "Sixty seconds. As many as you can." },
  { to: "/spain", title: "Spain", tagline: "Autonomous communities and provinces, with flags and capitals." },
  { to: "/challenges", title: "Daily Quest", tagline: "One short set a day. Unlock continents as you master them." },
];

const STEPS = [
  {
    title: "Answer a short question",
    body: "Find a country on the globe, name it, or match a flag or a capital. A session takes a few minutes.",
  },
  {
    title: "Review it just before you forget",
    body: "Orbita schedules every country with spaced repetition. What you miss comes back sooner, what you know comes back later.",
  },
  {
    title: "Watch the map fill in",
    body: "Each country takes color as you learn it, so you always see what is solid and what is slipping.",
  },
];

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const due = useDueTodayCount();
  const mastery = useCountryMastery();
  const [onboarding, setOnboarding] = useState(false);
  const total = COUNTRIES.length;
  const learned = [...mastery.values()].filter((s) => s !== "new").length;

  const play = () => {
    if (hasSeenOnboarding()) void navigate({ to: "/find" });
    else setOnboarding(true);
  };
  const done = () => {
    setOnboarding(false);
    void navigate({ to: "/find" });
  };
  const cta = { signedIn: !!user, due, onPlay: play };

  return (
    <main>
      <Hero total={total} {...cta} />
      <HowItWorks />
      <ProgressSection mastery={mastery} learned={learned} total={total} due={due} signedIn={!!user} />
      <ModesSection />
      {!user && <AccountBand />}
      <FinalCta {...cta} />
      <Footer signedIn={!!user} />
      <OnboardingOverlay open={onboarding} onComplete={done} onSkip={done} />
    </main>
  );
}

type CtaProps = { signedIn: boolean; due: number; onPlay: () => void };

/** One primary action. Guests are pushed to create an account; playing as a guest stays one click away. */
function Cta({ signedIn, due, onPlay }: CtaProps) {
  if (signedIn) {
    return due > 0 ? (
      <Link to="/review">
        <Button size="lg" className="h-16 px-10 text-lg">
          Review {due} due today
        </Button>
      </Link>
    ) : (
      <Button size="lg" onClick={onPlay} className="h-16 px-10 text-lg">
        Continue learning
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Link to="/auth" search={{ mode: "signup" }}>
        <Button size="lg" className="h-16 px-10 text-lg">
          Create an account
        </Button>
      </Link>
      <button
        type="button"
        onClick={onPlay}
        className="rounded-full px-2 py-1 text-base text-white/80 underline decoration-white/25 underline-offset-[6px] outline-none transition-colors hover:text-white hover:decoration-white/60 focus-visible:ring-2 focus-visible:ring-cyan/60"
      >
        Play as a guest
      </button>
    </div>
  );
}

function Hero({ total, ...cta }: CtaProps & { total: number }) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const lift = useTransform(scrollY, [0, 600], [0, reduced ? 0 : -48]);
  const copyFade = useTransform(scrollY, [0, 500], [1, reduced ? 1 : 0.35]);
  return (
    <section className="mx-auto grid min-h-[min(900px,100dvh)] max-w-[1440px] items-center gap-10 px-6 pb-16 pt-24 md:px-12 lg:grid-cols-2 lg:gap-14">
      <motion.div
        variants={stagger(0.05, 0.08)}
        initial="hidden"
        animate="show"
        style={{ opacity: copyFade }}
        className="flex flex-col items-start gap-7"
      >
        <motion.h1
          variants={fadeUp}
          className="font-display font-semibold tracking-[-0.035em] text-white text-[clamp(2.75rem,6.8vw,6.5rem)] leading-[0.98] text-balance"
        >
          Fill in the whole map.
        </motion.h1>
        <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-white/80 md:text-xl">
          Orbita is a geography trainer for {total} countries, their capitals and flags. You answer short questions on
          a globe, and it brings each one back just before you forget it.
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-col items-start gap-4">
          <Cta {...cta} />
          <p className="text-sm text-white/60">
            {cta.signedIn
              ? "Your progress is saved to your account."
              : "Your progress and review schedule sync to every device."}
          </p>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.soft, delay: 0.2 }}
        style={{ y: lift }}
      >
        <LiveQuestion />
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-28 md:px-12">
      <Reveal>
        <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-white md:text-5xl text-balance">
          Learn once, then keep it
        </h2>
      </Reveal>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Reveal delay={i * 0.1} className="border-t border-white/15 pt-6">
              <span className="font-mono text-sm text-violet">{i + 1}</span>
              <h3 className="mt-3 font-display text-xl font-medium tracking-tight text-white">{s.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-white/70">{s.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProgressSection({
  mastery,
  learned,
  total,
  due,
  signedIn,
}: {
  mastery: ReturnType<typeof useCountryMastery>;
  learned: number;
  total: number;
  due: number;
  signedIn: boolean;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-28 md:px-12">
      <Reveal className="glass rounded-3xl p-6 md:p-10">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {signedIn ? "Where you stand" : "Where you start"}
          </h2>
          <p className="mt-2 text-base text-white/70">
            {learned === 0
              ? `Zero of ${total} countries so far. Your first session fills the first bar.`
              : `${learned} of ${total} countries learned, ${due} due today.`}
          </p>
        </div>
        <ContinentProgress mastery={mastery} />
      </Reveal>
    </section>
  );
}

function ModesSection() {
  const reduced = useReducedMotion();
  return (
    <section className="mx-auto grid max-w-[1440px] gap-10 px-6 pb-28 md:px-12 lg:grid-cols-[340px_1fr] lg:gap-20">
      <Reveal>
        <h2 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl text-balance">
          Seven ways to practice
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Pick how you want to train. Every mode feeds the same review schedule.
        </p>
      </Reveal>
      <motion.ul
        variants={stagger(0.05, 0.06)}
        initial={reduced ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="border-t border-white/15"
      >
        {MODES.map((m) => (
          <motion.li key={m.to} variants={fadeUp} className="border-b border-white/10">
            <Link
              to={m.to}
              className="group relative flex flex-col gap-1 py-5 pl-3 pr-3 outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] sm:flex-row sm:items-baseline sm:gap-6"
            >
              <span
                aria-hidden
                className="absolute inset-y-3 left-0 w-0.5 origin-center scale-y-0 rounded-full bg-violet transition-transform duration-300 group-hover:scale-y-100 group-focus-visible:scale-y-100"
              />
              <span className="font-display text-xl font-medium tracking-tight text-white transition-transform duration-300 group-hover:translate-x-1 sm:w-44">
                {m.title}
              </span>
              <span className="text-[15px] text-white/70">{m.tagline}</span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function AccountBand() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-28 md:px-12">
      <Reveal className="glass-strong flex flex-col items-start justify-between gap-8 rounded-3xl p-8 md:flex-row md:items-center md:p-12">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Keep your progress
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/75">
            As a guest, your progress lives on this device only. An account keeps your map and review schedule safe and
            in sync on every device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="lg">Create an account</Button>
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="rounded-full px-2 py-1 text-base text-white/80 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-cyan/60"
          >
            Sign in
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function FinalCta(cta: CtaProps) {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-32 md:px-12">
      <Reveal className="flex flex-col items-center gap-8 text-center">
        <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-white md:text-6xl text-balance">
          Your first question is one click away.
        </h2>
        <Cta {...cta} />
      </Reveal>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Practice",
    links: [
      { to: "/find", label: "Find It" },
      { to: "/name", label: "Name It" },
      { to: "/flags", label: "Flags" },
      { to: "/capitals", label: "Capitals" },
      { to: "/speed", label: "Speed Round" },
      { to: "/spain", label: "Spain" },
    ],
  },
  {
    title: "Platform",
    links: [
      { to: "/review", label: "Review" },
      { to: "/challenges", label: "Daily Quest" },
      { to: "/progress", label: "Progress" },
      { to: "/explorer", label: "Explorer" },
    ],
  },
];

function Footer({ signedIn }: { signedIn: boolean }) {
  const linkClass =
    "rounded text-[15px] text-white/65 outline-none transition-colors hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-cyan/60";
  return (
    <footer className="border-t border-white/10 px-6 pb-8 pt-16 md:px-12">
      <div className="mx-auto grid max-w-[1440px] gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="font-display text-2xl font-semibold tracking-tight text-white">Orbita</p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            A geography trainer for countries, capitals and flags, built on spaced repetition.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-display text-base font-medium text-white">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Account">
          <h2 className="font-display text-base font-medium text-white">Account</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {signedIn ? (
              <li>
                <Link to="/account" className={linkClass}>
                  Your account
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link to="/auth" search={{ mode: "signup" }} className={linkClass}>
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link to="/auth" search={{ mode: "signin" }} className={linkClass}>
                    Sign in
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-14 max-w-[1440px] border-t border-white/10 pt-6 text-sm text-white/55">
        <p>&copy; {new Date().getFullYear()} Orbita</p>
      </div>
    </footer>
  );
}
