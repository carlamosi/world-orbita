import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { u as useRouter, L as Link } from '../_libs/tanstack__react-router.mjs';
import { u as useQueryClient, a as useQuery } from '../_libs/tanstack__react-query.mjs';
import { u as useAuth } from './router-T2jDQtma.mjs';
import { supabase } from './client-CnjuyyaV.mjs';
import { c as createSsrRpc } from './createSsrRpc-BPYX2guf.mjs';
import { a as createServerFn } from './index.mjs';
import { r as requireSupabaseAuth } from './auth-middleware-C5JPW8h7.mjs';
import { toast } from '../_libs/sonner.mjs';
import '../_libs/seroval.mjs';
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
import '../_libs/tanstack__query-core.mjs';
import '../_libs/clsx.mjs';
import '../_libs/tailwind-merge.mjs';
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
import 'tslib';
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
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import '../_libs/supabase__functions-js.mjs';
import 'node:async_hooks';
import '../_libs/h3-v2.mjs';
import '../_libs/rou3.mjs';
import '../_libs/srvx.mjs';

const deleteAccount = createServerFn({
  method: "POST"
}).middleware([requireSupabaseAuth]).handler(createSsrRpc("605045233debcf4fbca7c93f06a21eab51d31e90e5fab3208ca6233b08e8f1d1"));

function AccountPage() {
  const {
    user
  } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirm, setConfirm] = reactExports.useState("");
  const [deleting, setDeleting] = reactExports.useState(false);
  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("profiles").select("display_name, avatar_flag").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    }
  });
  const displayName = profileQ.data?.display_name?.trim() || user?.email?.split("@")[0] || "Orbita Explorer";
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    const {
      swap
    } = await import('./orbita-db-Bdp3ClIj.mjs').then(n => n.b);
    await swap(null);
    router.navigate({
      to: "/",
      replace: true
    });
  };
  const handleDelete = async () => {
    if (confirm !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAccount();
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      const {
        swap
      } = await import('./orbita-db-Bdp3ClIj.mjs').then(n => n.b);
      await swap(null);
      toast.success("Your account has been deleted.");
      router.navigate({
        to: "/auth",
        replace: true
      });
    } catch (e) {
      setDeleting(false);
      toast.error(e instanceof Error ? e.message : "Couldn't delete the account.");
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "min-h-dvh px-4 pt-28 pb-16 max-w-3xl mx-auto", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-display font-semibold text-white", children: "Account" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-white/60", children: "Your Orbita identity and sync settings." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-8 glass rounded-2xl p-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm uppercase tracking-wider text-white/50", children: "Identity" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 text-sm text-white/85", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-2xl text-white tracking-tight", children: displayName }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[12px] text-white/55 mt-1", children: user?.email }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[10px] font-mono text-white/35 mt-2", children: [
          "User ID: ",
          user?.id
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-4 glass rounded-2xl p-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm uppercase tracking-wider text-white/50", children: "Sync" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-white/70", children: "Your progress is mirrored to the cloud automatically. Game data lives locally for instant play." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/account/sync", className: "mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15", children: "View sync status →" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-4 glass rounded-2xl p-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm uppercase tracking-wider text-white/50", children: "Session" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: signOut, className: "mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:bg-white/10", children: "Sign out" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-4 glass rounded-2xl p-6 border-rose-500/15", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm uppercase tracking-wider text-rose-300/80", children: "Danger zone" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-white/70", children: "Permanently deletes your profile, progress, sessions, unlocks, and streak across every device. This cannot be undone." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: confirm, onChange: (e) => setConfirm(e.target.value), placeholder: 'Type "DELETE" to confirm', className: "rounded-full bg-black/30 border border-white/15 px-3 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-rose-400/50 min-w-[220px]" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { disabled: confirm !== "DELETE" || deleting, onClick: handleDelete, className: "inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed", children: deleting ? "Deleting…" : "Delete account" })
      ] })
    ] })
  ] });
}

export { AccountPage as component };
