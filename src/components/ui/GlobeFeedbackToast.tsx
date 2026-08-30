import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlobeToast {
  kind: "correct" | "wrong";
  name: string;
  subtitle?: string;
  wrongName?: string;
}

export function GlobeFeedbackToast({ toast }: { toast: GlobeToast | null }) {
  return (
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={`${toast.kind}-${toast.name}-${toast.subtitle ?? ""}`}
          initial={{ opacity: 0, scale: 0.7, y: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -12 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
        >
          <div className="relative flex flex-col items-center gap-3">
            {/* Ripple rings */}
            <RippleRings kind={toast.kind} />

            {/* Icon badge */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.04 }}
              className={cn(
                "relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 backdrop-blur-xl shadow-2xl",
                toast.kind === "correct"
                  ? "border-emerald-400/80 bg-emerald-950/70 shadow-emerald-500/40"
                  : "border-rose-400/80 bg-rose-950/70 shadow-rose-500/40",
              )}
            >
              <span
                className={cn(
                  "text-3xl font-bold leading-none",
                  toast.kind === "correct" ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {toast.kind === "correct" ? "✓" : "✕"}
              </span>
            </motion.div>

            {/* Country/Capital name pill */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
              className={cn(
                "relative z-10 rounded-full border px-5 py-2.5 backdrop-blur-xl shadow-xl flex flex-col items-center",
                toast.kind === "correct"
                  ? "border-emerald-500/40 bg-emerald-950/85 shadow-emerald-500/20"
                  : "border-rose-500/40 bg-rose-950/85 shadow-rose-500/20",
              )}
            >
              <p
                className={cn(
                  "font-display text-xl font-semibold tracking-tight text-center",
                  toast.kind === "correct" ? "text-emerald-200" : "text-rose-200",
                )}
              >
                {toast.name}
              </p>
              {toast.subtitle && (
                <p
                  className={cn(
                    "text-xs font-mono tracking-wider opacity-90",
                    toast.kind === "correct" ? "text-emerald-300/90" : "text-rose-300/90",
                  )}
                >
                  {toast.subtitle}
                </p>
              )}
              {toast.kind === "wrong" && toast.wrongName && (
                <p className="mt-0.5 text-center text-[11px] font-mono uppercase tracking-wider text-rose-400/90">
                  You clicked {toast.wrongName}
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RippleRings({ kind }: { kind: "correct" | "wrong" }) {
  const color = kind === "correct" ? "rgba(16,185,129," : "rgba(244,63,94,";
  const rings = [0, 1, 2];

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {rings.map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            borderColor: `${color}0.7)`,
            boxShadow: `0 0 20px ${color}0.3)`,
          }}
          initial={{ width: 64, height: 64, opacity: 0.9 }}
          animate={{
            width: [64, 220 + i * 80],
            height: [64, 220 + i * 80],
            opacity: [0.9, 0],
          }}
          transition={{
            duration: 1.1,
            delay: i * 0.18,
            ease: "easeOut",
            repeat: 0,
          }}
        />
      ))}
    </div>
  );
}
