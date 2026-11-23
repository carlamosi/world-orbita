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
import { WorldMap } from "@/features/home/WorldMap";
import { Reveal } from "@/features/home/Reveal";
import { useCountryMastery } from "@/features/home/mastery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbita | Learn every country" },
      {
        name: "description",
        content:
          "Learn 195 countries, their capitals and flags on a globe. Orbita brings back what you are about to forget.",
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
  { to: "/find", title: "Find It", tagline: "Point to a country on the globe." },
  { to: "/name", title: "Name It", tagline: "A country zooms in. Say which." },
  { to: "/flags", title: "Flags", tagline: "Match flags to countries, Easy or Hard." },
  { to: "/capitals", title: "Capitals", tagline: "Pair each country with its capital." },
  { to: "/speed", title: "Speed Round", tagline: "60 seconds, as many as you can." },
  { to: "/spain", title: "Spain", tagline: "19 communities and 50 provinces." },
  { to: "/challenges", title: "Daily Quest", tagline: "One short set a day. Unlock continents." },
];

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const due = useDueTodayCount();
  const mastery = useCountryMastery();
  const [onboarding, setOnboarding] = useState(false);
  const total = COUNTRIES.length;
  const learned = [...mastery.values()].filter((s) => s !== "new").length;

  const begin = () => {
    if (hasSeenOnboarding()) void navigate({ to: "/find" });
    else setOnboarding(true);
  };
  const done = () => {
    setOnboarding(false);
    void navigate({ to: "/find" });
  };

  return (
    <main>
      <Hero due={due} onBegin={begin} signedIn={!!user} />
      <MapSection mastery={mastery} learned={learned} total={total} due={due} />
      <ModesSection />
      {!user && <GuestSave />}
      <FinalCta due={due} onBegin={begin} />
      <Footer />
      <OnboardingOverlay open={onboarding} onComplete={done} onSkip={done} />
    </main>
  );
}

function Hero({ due, onBegin, signedIn }: { due: number; onBegin: () => void; signedIn: boolean }) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const lift = useTransform(scrollY, [0, 600], [0, reduced ? 0 : -48]);
  const copyFade = useTransform(scrollY, [0, 500], [1, reduced ? 1 : 0.35]);
  return (
    <section className="mx-auto grid min-h-[min(900px,100dvh)] max-w-[1440px] items-center gap-10 px-6 pb-16 pt-24 md:px-12 lg:grid-cols-[1fr_1fr] lg:gap-14">
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
        <motion.p variants={fadeUp} className="max-w-md text-lg leading-relaxed text-white/70">
          Answer a question, and Orbita brings back what you are about to forget. 195 countries, their capitals and
          flags.
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-col items-start gap-3">
          {due > 0 ? (
            <Link to="/review">
              <Button size="lg" className="h-16 px-10 text-lg">Review {due} due today</Button>
            </Link>
          ) : (
            <Button size="lg" onClick={onBegin} className="h-16 px-10 text-lg">
              Start playing
            </Button>
          )}
          <p className="text-sm text-white/60">
            {signedIn
              ? "Your progress is saved to your account."
              : "No account needed. Progress saves on this device."}
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

function MapSection({
  mastery,
  learned,
  total,
  due,
}: {
  mastery: ReturnType<typeof useCountryMastery>;
  learned: number;
  total: number;
  due: number;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-28 md:px-12">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">Your map</h2>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-white/70">
            One dot per country. A dot takes color as you learn it, and goes coral when you start to forget it.
          </p>
        </div>
        <p className="font-mono text-sm text-white/70 tabular-nums">
          {learned} of {total} learned · {due} due today
        </p>
      </Reveal>
      <Reveal delay={0.1} className="glass rounded-3xl p-5 md:p-10">
        <WorldMap mastery={mastery} />
      </Reveal>
    </section>
  );
}

function ModesSection() {
  const reduced = useReducedMotion();
  return (
    <section className="mx-auto grid max-w-[1440px] gap-10 px-6 pb-28 md:px-12 lg:grid-cols-[320px_1fr] lg:gap-20">
      <Reveal>
        <h2 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl text-balance">
          Seven ways to practice
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Every mode feeds the same schedule, so what you miss comes back sooner.
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
              <span className="text-[15px] text-white/65">{m.tagline}</span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function FinalCta({ due, onBegin }: { due: number; onBegin: () => void }) {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-28 md:px-12">
      <Reveal className="flex flex-col items-center gap-8 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-white md:text-6xl text-balance">
          Start with one question.
        </h2>
        {due > 0 ? (
          <Link to="/review">
            <Button size="lg" className="h-16 px-10 text-lg">Review {due} due today</Button>
          </Link>
        ) : (
          <Button size="lg" onClick={onBegin} className="h-16 px-10 text-lg">
            Start playing
          </Button>
        )}
      </Reveal>
    </section>
  );
}

function Footer() {
  const links = [
    { to: "/explorer", label: "Explorer" },
    { to: "/progress", label: "Progress" },
    { to: "/flags", label: "Flags" },
    { to: "/capitals", label: "Capitals" },
    { to: "/spain", label: "Spain" },
  ];
  return (
    <footer className="border-t border-white/10 px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 text-sm text-white/60 md:flex-row md:items-center">
        <p>
          <span className="font-display font-medium text-white">Orbita</span>
          <span className="ml-3">Learn every country, capital and flag.</span>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="outline-none hover:text-white focus-visible:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        <p>{new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}

function GuestSave() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-24 md:px-12">
      <Reveal className="glass-strong flex flex-col items-start justify-between gap-8 rounded-3xl p-8 md:flex-row md:items-center md:p-12">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Playing as a guest
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/70">
            Your progress is stored on this device only. Create an account to keep it and pick up on any device.
          </p>
        </div>
        <Link to="/auth" search={{ mode: "signup" }}>
          <Button variant="secondary" size="lg">
            Create an account
          </Button>
        </Link>
      </Reveal>
    </section>
  );
}
