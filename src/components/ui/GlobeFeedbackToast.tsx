import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
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
          key={`${toast.kind}-${toast.name}`}
          initial={{ opacity: 0, y: -16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="pointer-events-none absolute top-48 md:top-44 inset-x-0 z-40 flex justify-center px-4"
        >
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-full px-5 py-2 backdrop-blur-2xl border shadow-xl transition-all duration-200",
              toast.kind === "correct"
                ? "bg-slate-950/80 border-emerald-500/40 shadow-[0_8px_30px_rgba(16,185,129,0.25)]"
                : "bg-slate-950/85 border-rose-500/40 shadow-[0_8px_30px_rgba(244,63,94,0.25)]",
            )}
          >
            {/* Visual Icon Badge */}
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0",
                toast.kind === "correct"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.5)]",
              )}
            >
              {toast.kind === "correct" ? <Check className="size-3.5 stroke-[3]" /> : <X className="size-3.5 stroke-[3]" />}
            </div>

            {/* Clean Name & Optional Subtitle */}
            <span
              className={cn(
                "font-display text-base font-bold tracking-tight",
                toast.kind === "correct" ? "text-emerald-100" : "text-rose-100",
              )}
            >
              {toast.name}
            </span>

            {toast.subtitle && (
              <span className="text-[11px] font-mono text-white/50 border-l border-white/10 pl-2">
                {toast.subtitle}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

