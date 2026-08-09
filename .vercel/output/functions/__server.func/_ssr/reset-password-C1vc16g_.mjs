import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { u as useRouter, L as Link } from '../_libs/tanstack__react-router.mjs';
import { supabase } from './client-CnjuyyaV.mjs';
import { a as authDebug } from './router-T2jDQtma.mjs';
import { toast } from '../_libs/sonner.mjs';
import { m as motion } from '../_libs/framer-motion.mjs';
import { A as ArrowLeft, L as Lock, E as EyeOff, f as Eye, g as LoaderCircle } from '../_libs/lucide-react.mjs';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import 'node:stream';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
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
import '../_libs/react-remove-scroll-bar.mjs';
import '../_libs/react-style-singleton.mjs';
import '../_libs/get-nonce.mjs';
import '../_libs/use-sidecar.mjs';
import '../_libs/use-callback-ref.mjs';
import '../_libs/zustand.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';

function scorePassword(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = reactExports.useState("");
  const [confirm, setConfirm] = reactExports.useState("");
  const [show, setShow] = reactExports.useState(false);
  const [busy, setBusy] = reactExports.useState(false);
  const [ready, setReady] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const {
      data: sub
    } = supabase.auth.onAuthStateChange((event, session) => {
      authDebug("reset password event", {
        event,
        hasSession: !!session,
        userId: session?.user.id
      });
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({
      data
    }) => {
      authDebug("reset password session restore", {
        hasSession: !!data.session,
        userId: data.session?.user.id
      });
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const score = reactExports.useMemo(() => scorePassword(password), [password]);
  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      authDebug("reset password update:start");
      const {
        error
      } = await supabase.auth.updateUser({
        password
      });
      if (error) throw error;
      authDebug("reset password update:success");
      toast.success("Password updated");
      router.navigate({
        to: "/"
      });
    } catch (err) {
      authDebug("reset password update:failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "min-h-dvh flex items-center justify-center px-4 pt-24 pb-12", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.section, { initial: {
    opacity: 0,
    y: 16
  }, animate: {
    opacity: 1,
    y: 0
  }, transition: {
    duration: 0.5
  }, className: "glass-strong w-full max-w-md rounded-3xl p-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/auth", className: "inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "size-3.5" }),
      "Back to sign in"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-5 font-display text-[26px] font-semibold text-foreground", children: "Set a new password" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1.5 text-sm text-muted-foreground", children: ready ? "Choose a strong password you'll remember." : "Open this page from the reset link in your email." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit, className: "mt-7 space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-cyan/60", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: show ? "text" : "password", autoComplete: "new-password", placeholder: "New password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 8, className: "w-full bg-transparent pl-10 pr-10 py-2.5 text-sm outline-none" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => setShow((s) => !s), className: "absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground", "aria-label": show ? "Hide password" : "Show password", children: show ? /* @__PURE__ */ jsxRuntimeExports.jsx(EyeOff, { className: "size-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { className: "size-4" }) })
      ] }),
      password && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1.5 w-full overflow-hidden rounded-full bg-white/5", children: /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { animate: {
        width: `${score / 5 * 100}%`
      }, className: "h-full rounded-full", style: {
        background: score <= 1 ? "var(--coral)" : score <= 3 ? "var(--cyan)" : "var(--neon)"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-cyan/60", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: show ? "text" : "password", autoComplete: "new-password", placeholder: "Confirm new password", value: confirm, onChange: (e) => setConfirm(e.target.value), required: true, className: "w-full bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", disabled: busy || !ready, className: "w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60", style: {
        background: "linear-gradient(135deg, var(--violet), var(--cyan))",
        boxShadow: "0 10px 40px -10px color-mix(in oklab, var(--violet) 60%, transparent)"
      }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [
        busy && /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin" }),
        "Update password"
      ] }) })
    ] })
  ] }) });
}

export { ResetPasswordPage as component };
