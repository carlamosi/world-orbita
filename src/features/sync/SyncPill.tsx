import { create } from "zustand";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSyncStore } from "@/lib/sync/useSyncStore";
import { useRouter } from "@tanstack/react-router";
import { CloudOff, RefreshCw, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal sync indicator: visible only when syncing, offline, or errored.
 * After a successful sync, shows "Synced ✓" for 3s and then fades out.
 */
export function SyncPill() {
  const status = useSyncStore((s) => s.status);
  const queued = useSyncStore((s) => s.queued);
  const dead = useSyncStore((s) => s.dead);
  const signedIn = useSyncStore((s) => s.signedIn);
  const router = useRouter();
  const wasSyncing = useRef(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (status === "syncing") {
      wasSyncing.current = true;
      setJustSynced(false);
      return;
    }
    if (wasSyncing.current && (status === "synced" || status === "idle")) {
      wasSyncing.current = false;
      setJustSynced(true);
      const id = window.setTimeout(() => setJustSynced(false), 3000);
      return () => window.clearTimeout(id);
    }
  }, [status]);

  if (!signedIn) return null;

  const show =
    status === "syncing" ||
    status === "offline" ||
    status === "error" ||
    (status === "queued" && queued > 0) ||
    dead > 0 ||
    justSynced;

  let Icon = RefreshCw;
  let label = "Syncing…";
  let tone = "text-cyan-300";
  if (status === "offline") {
    Icon = CloudOff;
    label = "Offline";
    tone = "text-white/60";
  } else if (status === "error") {
    Icon = AlertCircle;
    label = "Sync error";
    tone = "text-rose-300";
  } else if (dead > 0) {
    Icon = AlertCircle;
    label = `Failed (${dead})`;
    tone = "text-rose-300";
  } else if (status === "queued") {
    Icon = RefreshCw;
    label = `Queued (${queued})`;
    tone = "text-amber-300";
  } else if (justSynced && status !== "syncing") {
    Icon = Check;
    label = "Synced";
    tone = "text-emerald-300";
  }

  // A fixed icon-sized slot: the status never changes the navbar's width.
  return (
    <span className="relative inline-flex size-7 shrink-0 items-center justify-center">
      <AnimatePresence>
        {show && (
          <motion.button
            key="sync-pill"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            transition={{ duration: 0.25 }}
            onClick={() => router.navigate({ to: "/account/sync" })}
            className={cn(
              "absolute inset-0 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5",
              tone,
            )}
            title={label}
            aria-label={`Cloud sync: ${label}`}
          >
            <Icon className={cn("size-3.5", status === "syncing" && "animate-spin")} />
          </motion.button>
        )}
      </AnimatePresence>
    </span>
  );
}

const useTick = create<{ t: number; tick: () => void }>((set) => ({
  t: 0,
  tick: () => set((s) => ({ t: s.t + 1 })),
}));

export function useSyncRefreshTicker() {
  const tick = useTick((s) => s.tick);
  useEffect(() => {
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [tick]);
}
