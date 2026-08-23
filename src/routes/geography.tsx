import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";

export const Route = createFileRoute("/geography")({
  head: () => ({
    meta: [
      { title: "Physical Geography — Orbita" },
      {
        name: "description",
        content: "Explore physical geography features: rivers, mountain ranges, peaks, and terrain on the 3D globe.",
      },
    ],
  }),
  component: GeographyPlaceholderPage,
});

function GeographyPlaceholderPage() {
  return (
    <div className="relative min-h-dvh pt-28 pb-16 px-4 flex flex-col items-center justify-center text-center">
      {/* Subtle background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(108,99,255,0.14)_0%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring.soft}
        className="glass-strong rounded-3xl p-8 md:p-12 max-w-xl w-full flex flex-col items-center gap-4 z-10 border border-white/15 shadow-2xl"
      >
        <div className="size-16 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-3xl shadow-inner mb-2">
          🏔️
        </div>

        <span className="glass px-3 py-1 rounded-full font-mono text-[11px] uppercase tracking-widest text-[color:var(--cyan)]">
          Coming Soon
        </span>

        <h1 className="font-display text-2xl md:text-3xl text-white font-semibold tracking-tight">
          Physical Geography
        </h1>

        <p className="text-white/60 text-sm md:text-base leading-relaxed max-w-md">
          A dedicated module for learning world topography, mountain ranges, major rivers, straits, and geographic landforms is currently in development.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 justify-center font-mono text-xs text-white/40">
          <span className="glass px-2.5 py-1 rounded-lg">Rivers</span>
          <span className="glass px-2.5 py-1 rounded-lg">Mountains & Peaks</span>
          <span className="glass px-2.5 py-1 rounded-lg">Ranges & Basins</span>
        </div>
      </motion.div>
    </div>
  );
}
