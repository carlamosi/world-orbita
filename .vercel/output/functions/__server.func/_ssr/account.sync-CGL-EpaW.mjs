import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { b as useSyncStore } from './router-T2jDQtma.mjs';
import { forceSync, forceFullResync } from './workers-BgH30Fif.mjs';
import { d as db } from './orbita-db-Bdp3ClIj.mjs';
import '../_libs/sonner.mjs';
import './index.mjs';
import '../_libs/seroval.mjs';
import '../_libs/dexie.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
import '../_libs/tanstack__react-router.mjs';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
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
import '../_libs/framer-motion.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/zustand.mjs';
import './createSsrRpc-BPYX2guf.mjs';
import './auth-middleware-C5JPW8h7.mjs';
import '../_libs/zod.mjs';
import 'node:async_hooks';
import '../_libs/h3-v2.mjs';
import '../_libs/rou3.mjs';
import '../_libs/srvx.mjs';

function fmt(ts) {
  if (!ts) return "—";
  const s = Math.round((Date.now() - ts) / 1e3);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}
function SyncPage() {
  const {
    status,
    queued,
    lastPushAt,
    lastPullAt,
    lastError
  } = useSyncStore();
  const [cursors, setCursors] = reactExports.useState({});
  const [dead, setDead] = reactExports.useState(0);
  reactExports.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const c = {};
        const all = await db().sync_meta.toArray();
        for (const row of all) c[row.key] = row.value;
        const d = await db().outbox.where("status").equals("dead").count();
        if (!cancelled) {
          setCursors(c);
          setDead(d);
        }
      } catch {
      }
    };
    load();
    const id = setInterval(load, 2e3);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "min-h-dvh px-4 pt-28 pb-16 max-w-3xl mx-auto", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-display font-semibold text-white", children: "Sync" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-white/60", children: "Status of your local-first sync queue." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-8 grid sm:grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Status", value: status }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Queued", value: String(queued) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Last push", value: fmt(lastPushAt) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Last pull", value: fmt(lastPullAt) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Dead-letter", value: String(dead) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Last error", value: lastError ?? "—" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: forceSync, className: "inline-flex items-center rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white", children: "Force sync now" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => void forceFullResync(), className: "inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10", children: "Force full resync" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-8 glass rounded-2xl p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm uppercase tracking-wider text-white/50", children: "Cursors" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "mt-3 space-y-1 text-[11px] text-white/70 font-mono", children: [
        Object.entries(cursors).length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "text-white/40", children: "no cursors yet" }),
        Object.entries(cursors).map(([k, v]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: k }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-white/40 truncate max-w-[60%]", children: v })
        ] }, k))
      ] })
    ] })
  ] });
}
function Stat({
  label,
  value
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass rounded-xl p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-wider text-white/40", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-sm text-white/90 truncate", children: value })
  ] });
}

export { SyncPage as component };
