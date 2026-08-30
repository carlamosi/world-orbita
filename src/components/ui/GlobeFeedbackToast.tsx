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
          key={`${toast.kind}-${toast.name}-${toast.wrongName ?? ""}`}
          initial={{ opacity: 0, y: -24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 480, damping: 28 }}
          className="pointer-events-none absolute top-48 md:top-44 inset-x-0 z-40 flex justify-center px-4"
        >
          <div
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-2xl px-6 py-3.5 backdrop-blur-2xl border shadow-2xl transition-all duration-300 max-w-md w-full",
              toast.kind === "correct"
                ? "bg-slate-950/80 border-emerald-500/40 shadow-[0_12px_40px_-8px_rgba(16,185,129,0.3)]"
                : "bg-slate-950/85 border-rose-500/40 shadow-[0_12px_40px_-8px_rgba(244,63,94,0.3)]",
            )}
          >
            {/* Header: Icon + Result Label */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0",
                  toast.kind === "correct"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.5)]",
                )}
              >
                {toast.kind === "correct" ? <Check className="size-3.5 stroke-[3]" /> : <X className="size-3.5 stroke-[3]" />}
              </div>
              <span
                className={cn(
                  "font-mono text-xs uppercase tracking-[0.2em] font-semibold",
                  toast.kind === "correct" ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {toast.kind === "correct" ? "Correct" : "Incorrect"}
              </span>
            </div>

            {/* Content: Target and Differential Comparison */}
            {toast.kind === "correct" ? (
              <div className="flex flex-col items-center">
                <span className="font-display text-lg font-bold text-white tracking-tight">
                  {toast.name}
                </span>
                {toast.subtitle && (
                  <span className="text-[12px] font-mono text-white/60">
                    {toast.subtitle}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 w-full">
                {toast.wrongName && (
                  <div className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[11px] font-mono text-rose-300/70 uppercase tracking-wider">
                      You clicked
                    </span>
                    <span className="text-xs font-semibold text-rose-200">
                      {toast.wrongName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] font-mono text-emerald-300/70 uppercase tracking-wider">
                    Correct target
                  </span>
                  <span className="text-xs font-semibold text-emerald-200">
                    {toast.name}
                  </span>
                </div>
                {toast.subtitle && (
                  <span className="text-[11px] font-mono text-white/50">
                    {toast.subtitle}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

