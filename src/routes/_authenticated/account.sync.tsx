import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSyncStore } from "@/lib/sync/useSyncStore";
import { forceSync, forceFullResync, clearDeadLetter } from "@/lib/sync/workers";
import { db, type OutboxRow } from "@/lib/db/orbita-db";

export const Route = createFileRoute("/_authenticated/account/sync")({
  head: () => ({ meta: [{ title: "Sync · Orbita" }] }),
  component: SyncPage,
});

function fmt(ts: number | null) {
  if (!ts) return "—";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function SyncPage() {
  const { status, queued, lastPushAt, lastPullAt, lastError } = useSyncStore();
  const [cursors, setCursors] = useState<Record<string, string>>({});
  const [dead, setDead] = useState<number>(0);
  const [failedItems, setFailedItems] = useState<OutboxRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const c: Record<string, string> = {};
        const all = await db().sync_meta.toArray();
        for (const row of all) c[row.key] = row.value;
        const d = await db().outbox.where("status").equals("dead").count();
        // Show pending items that have errors (retried at least once)
        const failed = await db()
          .outbox.filter((r) => r.status !== "dead" && r.attempts > 0 && !!r.last_error)
          .toArray();
        if (!cancelled) {
          setCursors(c);
          setDead(d);
          setFailedItems(failed);
        }
      } catch {
        // ignore
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-dvh px-4 pt-28 pb-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-display font-semibold text-white">Sync</h1>
      <p className="mt-1 text-sm text-white/60">
        Status of your local-first sync queue.
      </p>

      <section className="mt-8 grid sm:grid-cols-2 gap-3">
        <Stat label="Status" value={status} />
        <Stat label="Queued" value={String(queued)} />
        <Stat label="Last push" value={fmt(lastPushAt)} />
        <Stat label="Last pull" value={fmt(lastPullAt)} />
        <Stat label="Dead-letter" value={String(dead)} />
        <Stat label="Last error" value={lastError ?? "—"} />
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => void forceSync()}
          className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Force sync now
        </button>
        <button
          onClick={() => void forceFullResync()}
          className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
        >
          Force full resync
        </button>
        {dead > 0 && (
          <button
            onClick={() => void clearDeadLetter()}
            className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
          >
            Clear {dead} dead-letter {dead === 1 ? "item" : "items"}
          </button>
        )}
      </div>

      {failedItems.length > 0 && (
        <section className="mt-6 glass rounded-2xl p-5">
          <h2 className="text-sm uppercase tracking-wider text-white/50">
            Retrying ({failedItems.length})
          </h2>
          <ul className="mt-3 space-y-2 text-[11px] font-mono">
            {failedItems.map((item) => (
              <li key={item.op_id} className="flex flex-col gap-0.5">
                <span className="text-white/70">
                  [{item.entity}] attempt {item.attempts}/{10}
                </span>
                {item.last_error && (
                  <span className="text-rose-300/80 truncate">{item.last_error}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 glass rounded-2xl p-5">
        <h2 className="text-sm uppercase tracking-wider text-white/50">Cursors</h2>
        <ul className="mt-3 space-y-1 text-[11px] text-white/70 font-mono">
          {Object.entries(cursors).length === 0 && (
            <li className="text-white/40">no cursors yet</li>
          )}
          {Object.entries(cursors).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span>{k}</span>
              <span className="text-white/40 truncate max-w-[60%]">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-sm text-white/90 truncate">{value}</div>
    </div>
  );
}
