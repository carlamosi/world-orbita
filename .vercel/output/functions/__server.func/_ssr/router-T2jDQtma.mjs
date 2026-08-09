import { b as QueryClient } from '../_libs/tanstack__query-core.mjs';
import { Q as QueryClientProvider, u as useQueryClient } from '../_libs/tanstack__react-query.mjs';
import { c as createRouter, a as createRootRouteWithContext, u as useRouter, L as Link, O as Outlet, H as HeadContent, S as Scripts, b as createFileRoute, l as lazyRouteComponent, d as useRouterState } from '../_libs/tanstack__react-router.mjs';
import { S as redirect } from '../_libs/tanstack__router-core.mjs';
import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { c as clsx } from '../_libs/clsx.mjs';
import { t as twMerge } from '../_libs/tailwind-merge.mjs';
import { supabase } from './client-CnjuyyaV.mjs';
import { R as Root2, T as Trigger, P as Portal2, C as Content2, I as Item2, S as Separator2, a as SubTrigger2, b as SubContent2, c as CheckboxItem2, d as ItemIndicator2, e as RadioItem2, L as Label2 } from '../_libs/radix-ui__react-dropdown-menu.mjs';
import { Toaster as Toaster$1 } from '../_libs/sonner.mjs';
import { A as AnimatePresence, m as motion } from '../_libs/framer-motion.mjs';
import { G as Globe, X, R as RefreshCw, C as CircleUserRound, a as CloudOff, b as CircleAlert, c as Check, d as ChevronRight, e as Circle } from '../_libs/lucide-react.mjs';
import { c as create } from '../_libs/zustand.mjs';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import 'node:stream';
import '../_libs/isbot.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
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
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';

const appCss = "/assets/styles-CzhhAMC2.css";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const useSyncStore = create((set) => ({
  status: "idle",
  queued: 0,
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  signedIn: false,
  setStatus: (status) => set({ status }),
  setQueued: (queued) => set({ queued }),
  setLastPush: (t) => set({ lastPushAt: t }),
  setLastPull: (t) => set({ lastPullAt: t }),
  setError: (lastError) => set({ lastError }),
  setSignedIn: (signedIn) => set({ signedIn })
}));

const useSyncStore$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  useSyncStore
}, Symbol.toStringTag, { value: 'Module' }));

function SyncPill() {
  const status = useSyncStore((s) => s.status);
  const queued = useSyncStore((s) => s.queued);
  const signedIn = useSyncStore((s) => s.signedIn);
  const router = useRouter();
  const wasSyncing = reactExports.useRef(false);
  const [justSynced, setJustSynced] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (status === "syncing") {
      wasSyncing.current = true;
      setJustSynced(false);
      return;
    }
    if (wasSyncing.current && (status === "synced" || status === "idle")) {
      wasSyncing.current = false;
      setJustSynced(true);
      const id = window.setTimeout(() => setJustSynced(false), 3e3);
      return () => window.clearTimeout(id);
    }
  }, [status]);
  if (!signedIn) return null;
  const show = status === "syncing" || status === "offline" || status === "error" || status === "queued" && queued > 0 || justSynced;
  let Icon = RefreshCw;
  let label = "Syncing…";
  let tone = "text-cyan-300";
  if (status === "offline") {
    Icon = CloudOff;
    label = "Offline";
    tone = "text-white/60";
  } else if (status === "error") {
    Icon = CircleAlert;
    label = "Sync error";
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: show && /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.button,
    {
      initial: { opacity: 0, y: -4 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, transition: { duration: 0.6 } },
      transition: { duration: 0.25 },
      onClick: () => router.navigate({ to: "/account/sync" }),
      className: cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]",
        tone
      ),
      title: "Cloud sync",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: cn("size-3", status === "syncing" && "animate-spin") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: label })
      ]
    },
    "sync-pill"
  ) });
}
create((set) => ({
  t: 0,
  tick: () => set((s) => ({ t: s.t + 1 }))
}));

function authDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("orbita-auth-debug") === "1";
  } catch {
    return false;
  }
}
function authDebug(event, details = {}) {
  if (!authDebugEnabled()) return;
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/token|secret|key|password/i.test(key))
  );
  console.debug(`[ORBITA auth] ${event}`, safeDetails);
}

function useAuth() {
  const [user, setUser] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      authDebug("state change", { event: _event, hasSession: !!session, userId: session?.user.id });
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      authDebug("session restore", { hasSession: !!data.session, userId: data.session?.user.id });
      if (!data.session) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data: userData, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !userData.user) {
        authDebug("session restore invalid", { error: error?.message });
        setUser(null);
      } else {
        setUser(userData.user);
      }
      setLoading(false);
    }).catch((error) => {
      if (!mounted) return;
      authDebug("session restore failed", { error: error instanceof Error ? error.message : String(error) });
      setUser(null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { user, loading, signedIn: !!user };
}

const DropdownMenu = Root2;
const DropdownMenuTrigger = Trigger;
const DropdownMenuSubTrigger = reactExports.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  SubTrigger2,
  {
    ref,
    className: cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    ),
    ...props,
    children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "ml-auto" })
    ]
  }
));
DropdownMenuSubTrigger.displayName = SubTrigger2.displayName;
const DropdownMenuSubContent = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  SubContent2,
  {
    ref,
    className: cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
      className
    ),
    ...props
  }
));
DropdownMenuSubContent.displayName = SubContent2.displayName;
const DropdownMenuContent = reactExports.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(Portal2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
  Content2,
  {
    ref,
    sideOffset,
    className: cn(
      "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
      className
    ),
    ...props
  }
) }));
DropdownMenuContent.displayName = Content2.displayName;
const DropdownMenuItem = reactExports.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Item2,
  {
    ref,
    className: cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    ),
    ...props
  }
));
DropdownMenuItem.displayName = Item2.displayName;
const DropdownMenuCheckboxItem = reactExports.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  CheckboxItem2,
  {
    ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    ),
    checked,
    ...props,
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicator2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-4 w-4" }) }) }),
      children
    ]
  }
));
DropdownMenuCheckboxItem.displayName = CheckboxItem2.displayName;
const DropdownMenuRadioItem = reactExports.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  RadioItem2,
  {
    ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicator2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Circle, { className: "h-2 w-2 fill-current" }) }) }),
      children
    ]
  }
));
DropdownMenuRadioItem.displayName = RadioItem2.displayName;
const DropdownMenuLabel = reactExports.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Label2,
  {
    ref,
    className: cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className),
    ...props
  }
));
DropdownMenuLabel.displayName = Label2.displayName;
const DropdownMenuSeparator = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Separator2,
  {
    ref,
    className: cn("-mx-1 my-1 h-px bg-muted", className),
    ...props
  }
));
DropdownMenuSeparator.displayName = Separator2.displayName;

function AccountMenu() {
  const { user, signedIn } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  if (!signedIn) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Link,
      {
        to: "/auth",
        search: { mode: "signup" },
        className: "inline-flex items-center gap-1.5 text-[12px] text-white/90 hover:text-white px-3 py-1.5 rounded-full border border-neon/25 bg-neon/10 hover:bg-neon/15 transition-colors",
        title: "Create an account to sync your progress",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": true, children: "💾" }),
          " Save progress"
        ]
      }
    );
  }
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pl-1.5 pr-2.5 py-1 text-[12px] text-white/85 hover:bg-white/10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-5 grid place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-[10px] font-semibold text-white", children: initial }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline truncate max-w-[120px]", children: user?.email ?? "Account" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", className: "w-56", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/account", className: "cursor-pointer", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleUserRound, { className: "mr-2 size-4" }),
        " Account"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/account/sync", className: "cursor-pointer", children: "Sync status" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuItem, { onClick: handleSignOut, className: "cursor-pointer text-rose-300", children: "Sign out" })
    ] })
  ] });
}

const NAV = [
  { to: "/explorer", label: "Explorer" },
  { to: "/find", label: "Find" },
  { to: "/name", label: "Name" },
  { to: "/flags", label: "Flags" },
  { to: "/capitals", label: "Capitals" },
  { to: "/speed", label: "Speed" },
  { to: "/progress", label: "Progress" },
  { to: "/challenges", label: "Challenges" }
];
function OrbitalLogo() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "26", height: "26", viewBox: "0 0 32 32", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("defs", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("radialGradient", { id: "lg", cx: "50%", cy: "50%", r: "50%", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "0%", stopColor: "#6c63ff" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "100%", stopColor: "#050508" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "16", cy: "16", r: "7", fill: "url(#lg)" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "ellipse",
      {
        cx: "16",
        cy: "16",
        rx: "13.5",
        ry: "5",
        stroke: "#00d4ff",
        strokeOpacity: "0.65",
        strokeWidth: "1",
        transform: "rotate(-22 16 16)"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "ellipse",
      {
        cx: "16",
        cy: "16",
        rx: "13.5",
        ry: "5",
        stroke: "#6c63ff",
        strokeOpacity: "0.5",
        strokeWidth: "1",
        transform: "rotate(28 16 16)"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "29", cy: "9", r: "1.3", fill: "#00ffb2" })
  ] });
}
function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.nav,
    {
      initial: { y: -16, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      transition: { type: "spring", stiffness: 120, damping: 22 },
      className: "glass rounded-full pl-4 pr-2 py-2 flex items-center gap-2 max-w-[min(96vw,1080px)] w-full",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/", className: "flex items-center gap-2 px-2 group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(OrbitalLogo, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display font-semibold tracking-tight text-white text-[15px]", children: "Orbita" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ml-2 hidden md:flex items-center gap-1 overflow-x-auto", children: NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Link,
            {
              to: item.to,
              className: cn(
                "relative px-3 py-1.5 text-[13px] rounded-full transition-colors",
                active ? "text-white" : "text-white/55 hover:text-white"
              ),
              children: [
                item.label,
                active && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  motion.span,
                  {
                    layoutId: "nav-active",
                    className: "absolute inset-0 -z-10 rounded-full bg-white/8 border border-white/10 shadow-[0_0_24px_-6px_color-mix(in_oklab,var(--cyan)_60%,transparent)]",
                    transition: { type: "spring", stiffness: 320, damping: 28 }
                  }
                )
              ]
            },
            item.to
          );
        }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ml-auto flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SyncPill, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Link,
            {
              to: "/explorer",
              className: "hidden sm:inline-flex items-center text-[13px] font-medium text-white rounded-full px-4 py-1.5 bg-white/10 border border-white/15 hover:bg-white/15",
              children: "Explore"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AccountMenu, {})
        ] })
      ]
    }
  ) });
}

function Starfield({ density = 120, className }) {
  const layers = reactExports.useMemo(() => {
    const makeShadow = (count, spread) => Array.from({ length: count }, () => {
      const x = Math.floor(Math.random() * spread);
      const y = Math.floor(Math.random() * spread);
      const a = (Math.random() * 0.7 + 0.3).toFixed(2);
      return `${x}px ${y}px 0 rgba(255,255,255,${a})`;
    }).join(",");
    return {
      a: makeShadow(density, 2e3),
      b: makeShadow(Math.floor(density * 0.5), 2e3),
      c: makeShadow(Math.floor(density * 0.25), 2e3)
    };
  }, [density]);
  const Layer = ({
    shadow,
    size,
    duration
  }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "aria-hidden": true,
      className: "absolute inset-0 overflow-hidden",
      style: {
        animation: `orbit-drift ${duration}s linear infinite`,
        animationDirection: "alternate"
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "absolute",
          style: {
            top: 0,
            left: 0,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "transparent",
            boxShadow: shadow
          }
        }
      )
    }
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "aria-hidden": true,
      className: `pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Layer, { shadow: layers.a, size: 1, duration: 240 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Layer, { shadow: layers.b, size: 1.5, duration: 360 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Layer, { shadow: layers.c, size: 2, duration: 520 })
      ]
    }
  );
}

const Toaster = ({ ...props }) => {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Toaster$1,
    {
      className: "toaster group",
      toastOptions: {
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
        }
      },
      ...props
    }
  );
};

function profileName(user, fallbackName) {
  const metadata = user.user_metadata ?? {};
  const candidate = fallbackName?.trim() || String(metadata.display_name ?? metadata.full_name ?? metadata.name ?? "").trim() || user.email?.split("@")[0] || "Orbita Explorer";
  return candidate.slice(0, 60);
}
async function ensureUserProfile(user, fallbackName) {
  authDebug("profile ensure:start", { userId: user.id, hasFallbackName: !!fallbackName });
  const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (lookupError) {
    authDebug("profile ensure:lookup failed", { userId: user.id, error: lookupError.message });
    throw lookupError;
  }
  if (existing) {
    authDebug("profile ensure:exists", { userId: user.id });
    return;
  }
  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: profileName(user, fallbackName)
  });
  if (insertError) {
    authDebug("profile ensure:insert failed", { userId: user.id, error: insertError.message });
    throw insertError;
  }
  authDebug("profile ensure:created", { userId: user.id });
}

const NUDGE_KEY = "orbita.nudge.shown";
function SaveProgressNudge() {
  const { signedIn, loading } = useAuth();
  const [visible, setVisible] = reactExports.useState(false);
  const [learnedCount, setLearnedCount] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (loading || signedIn) return;
    const onSessionEnd = (ev) => {
      if (sessionStorage.getItem(NUDGE_KEY)) return;
      sessionStorage.setItem(NUDGE_KEY, "1");
      const detail = ev.detail;
      setLearnedCount(Math.max(1, detail?.correct ?? 1));
      setTimeout(() => setVisible(true), 1200);
    };
    window.addEventListener("orbita:session-end", onSessionEnd);
    return () => window.removeEventListener("orbita:session-end", onSessionEnd);
  }, [loading, signedIn]);
  reactExports.useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 12e3);
    return () => clearTimeout(t);
  }, [visible]);
  const headline = learnedCount > 1 ? `You just learned ${learnedCount} countries!` : "You just completed your first session!";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: visible && /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      id: "save-progress-nudge",
      role: "status",
      "aria-live": "polite",
      initial: { opacity: 0, y: 80, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: 60, scale: 0.95 },
      transition: { type: "spring", stiffness: 320, damping: 28 },
      className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm",
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "relative rounded-2xl border border-white/10 px-4 py-3.5 flex items-center gap-3 shadow-2xl",
          style: {
            background: "linear-gradient(135deg, rgba(15,12,38,0.97) 0%, rgba(10,12,28,0.97) 100%)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 0 1px rgba(108,99,255,0.2), 0 20px 60px -10px rgba(108,99,255,0.3)"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              motion.div,
              {
                className: "shrink-0 grid place-items-center size-9 rounded-xl",
                animate: {
                  boxShadow: [
                    "0 0 12px rgba(0,255,178,0.4)",
                    "0 0 20px rgba(0,255,178,0.7)",
                    "0 0 12px rgba(0,255,178,0.4)"
                  ]
                },
                transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                style: {
                  background: "rgba(0,255,178,0.12)",
                  border: "1px solid rgba(0,255,178,0.25)"
                },
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(Globe, { className: "size-4 text-[color:var(--neon)]" })
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[13px] font-semibold text-white leading-tight", children: [
                "🌍 ",
                headline
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-white/55 mt-0.5 leading-tight", children: "Create a free account to keep your ORBITA memory map." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Link,
                {
                  to: "/auth",
                  search: { mode: "signup" },
                  onClick: () => setVisible(false),
                  className: "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  style: {
                    background: "linear-gradient(135deg, var(--violet), var(--cyan))",
                    boxShadow: "0 4px 14px -4px rgba(108,99,255,0.5)"
                  },
                  children: "Save your progress →"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  "aria-label": "Dismiss",
                  onClick: () => setVisible(false),
                  className: "grid place-items-center size-7 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "size-3.5" })
                }
              )
            ] })
          ]
        }
      )
    }
  ) });
}

function NotFoundComponent() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-7xl font-bold text-foreground", children: "404" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 text-xl font-semibold text-foreground", children: "Page not found" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "The page you're looking for doesn't exist or has been moved." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Link,
      {
        to: "/",
        className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        children: "Go home"
      }
    ) })
  ] }) });
}
function ErrorComponent({ error, reset }) {
  console.error(error);
  const router = useRouter();
  reactExports.useEffect(() => {
  }, [error]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-xl font-semibold tracking-tight text-foreground", children: "This page didn't load" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Something went wrong on our end. You can try refreshing or head back home." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex flex-wrap justify-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => {
            router.invalidate();
            reset();
          },
          className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          children: "Try again"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: "/",
          className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
          children: "Go home"
        }
      )
    ] })
  ] }) });
}
const Route$e = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#050508" },
      { title: "Orbita — Master every corner of the world" },
      {
        name: "description",
        content: "Orbita is a cinematic geography mastery platform. 195 countries, every capital, every flag — explored from orbit."
      },
      { property: "og:title", content: "Orbita — Master every corner of the world" },
      {
        property: "og:description",
        content: "A cinematic, immersive way to learn the world. 195 countries from orbit."
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Orbita — Master every corner of the world" },
      { name: "description", content: "Orbita is a cinematic geography mastery platform for immersive world learning." },
      { property: "og:description", content: "Orbita is a cinematic geography mastery platform for immersive world learning." },
      { name: "twitter:description", content: "Orbita is a cinematic geography mastery platform for immersive world learning." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe58fc7b-2ae5-46e1-a1fe-5f3774573e05/id-preview-8574e703--5a8151b1-20df-4a18-b0bf-c85e4802cce9.lovable.app-1781638547317.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe58fc7b-2ae5-46e1-a1fe-5f3774573e05/id-preview-8574e703--5a8151b1-20df-4a18-b0bf-c85e4802cce9.lovable.app-1781638547317.png" }
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://flagcdn.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      }
    ]
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent
});
function RootShell({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("html", { lang: "en", className: "dark", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("head", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx(Scripts, {})
    ] })
  ] });
}
function RootComponent() {
  const { queryClient } = Route$e.useRouteContext();
  const migratedRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    let mounted = true;
    let unsubscribeAuth = null;
    void import('./workers-BgH30Fif.mjs').then(({ startSyncWorkers }) => {
      if (!mounted) return;
      startSyncWorkers();
    });
    void Promise.all([
      import('./client-CnjuyyaV.mjs'),
      import('./orbita-db-Bdp3ClIj.mjs').then(n => n.b),
      Promise.resolve().then(() => useSyncStore$1)
    ]).then(([{ supabase }, { swap, getCurrent }, { useSyncStore }]) => {
      if (!mounted) return;
      const runMigration = async (uid) => {
        if (migratedRef.current) return;
        migratedRef.current = true;
        const { handleSignedInSync } = await import('./workers-BgH30Fif.mjs');
        const { toast } = await import('../_libs/sonner.mjs');
        const userDb = getCurrent();
        if (!userDb) return;
        const result = await handleSignedInSync(userDb, uid);
        if (result.migrated > 0) {
          authDebug("root:migration_done", result);
          toast.success(
            `✨ Saved ${result.migrated} items from your guest session`,
            { description: "Your progress has been merged into your account.", duration: 5e3 }
          );
        }
      };
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id ?? null;
        authDebug("root session restore", { hasSession: !!data.session, userId: uid });
        useSyncStore.getState().setSignedIn(!!uid);
        void swap(uid);
        if (data.session?.user) {
          void ensureUserProfile(data.session.user).catch(
            (error) => authDebug("root profile ensure failed", { error: error instanceof Error ? error.message : String(error) })
          );
          void swap(uid).then(() => runMigration(uid));
        }
      });
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED")
          return;
        const uid = session?.user.id ?? null;
        authDebug("root auth event", { event, hasSession: !!session, userId: uid });
        useSyncStore.getState().setSignedIn(!!uid);
        void swap(uid);
        if (session?.user) {
          void ensureUserProfile(session.user).catch(
            (error) => authDebug("root profile ensure failed", { error: error instanceof Error ? error.message : String(error) })
          );
          if (event === "SIGNED_IN") {
            void swap(uid).then(() => runMigration(uid));
          }
        }
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        if (event === "SIGNED_OUT") migratedRef.current = false;
      });
      unsubscribeAuth = () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
      unsubscribeAuth?.();
    };
  }, [queryClient]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(QueryClientProvider, { client: queryClient, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SaveProgressNudge, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Toaster, { position: "top-center", richColors: true, closeButton: true })
  ] });
}
function AppShell({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative min-h-dvh overflow-x-clip", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "aria-hidden": true, className: "pointer-events-none fixed inset-0 -z-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Starfield, { density: 140 }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "absolute inset-0",
          style: {
            background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(108,99,255,0.18), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 100%, rgba(0,212,255,0.12), transparent 60%)"
          }
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "absolute inset-0",
          style: {
            background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.6) 100%)"
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Navbar, {}),
    children
  ] });
}

const $$splitComponentImporter$d = () => import('./speed-B9DUMtpc.mjs');
const Route$d = createFileRoute("/speed")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Speed Round — Orbita"
    }, {
      name: "description",
      content: "Sixty seconds. Mixed-skill rapid fire. Build combos for ×5 multipliers."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$d, "component")
});

const $$splitComponentImporter$c = () => import('./reset-password-C1vc16g_.mjs');
const Route$c = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{
      title: "Reset password · Orbita"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$c, "component")
});

const $$splitComponentImporter$b = () => import('./progress-DMvkIeXH.mjs');
const Route$b = createFileRoute("/progress")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Progress — Orbita"
    }, {
      name: "description",
      content: "Confidence heatmaps, streaks, weak spots, and per-continent mastery."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$b, "component")
});

const $$splitComponentImporter$a = () => import('./name-BLvbReVt.mjs');
const Route$a = createFileRoute("/name")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Name It — Orbita"
    }, {
      name: "description",
      content: "Name the mystery country zoomed in from orbit."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$a, "component")
});

const $$splitComponentImporter$9 = () => import('./flags-DyQltmPu.mjs');
const Route$9 = createFileRoute("/flags")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Flags — Orbita"
    }, {
      name: "description",
      content: "Master every flag, both directions."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$9, "component")
});

const $$splitComponentImporter$8 = () => import('./find-COCZb71a.mjs');
const Route$8 = createFileRoute("/find")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Find It — Orbita"
    }, {
      name: "description",
      content: "Pinpoint countries on the orbital globe."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$8, "component")
});

const $$splitComponentImporter$7 = () => import('./explorer-C2sgB-F6.mjs');
const Route$7 = createFileRoute("/explorer")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Explorer — Orbita"
    }, {
      name: "description",
      content: "Browse the living atlas: spin the globe, pick a country, see your mastery in real time."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$7, "component")
});

const $$splitComponentImporter$6 = () => import('./challenges-DYABpHLH.mjs');
const Route$6 = createFileRoute("/challenges")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Challenges — Orbita"
    }, {
      name: "description",
      content: "Daily and weekly orbit runs — deterministic question sets, your best score."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$6, "component")
});

const $$splitComponentImporter$5 = () => import('./capitals-DhnHAygS.mjs');
const Route$5 = createFileRoute("/capitals")({
  ssr: false,
  head: () => ({
    meta: [{
      title: "Capitals — Orbita"
    }, {
      name: "description",
      content: "Match the world's seats of power."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$5, "component")
});

const $$splitComponentImporter$4 = () => import('./auth-D2ZlFJUw.mjs');
const Route$4 = createFileRoute("/auth")({
  validateSearch: (search) => ({
    mode: search.mode === "signup" || search.mode === "signin" ? search.mode : void 0
  }),
  head: () => ({
    meta: [{
      title: "Sign in · Orbita"
    }, {
      name: "description",
      content: "Sign in to Orbita to sync your geography mastery, streaks and challenges across devices."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$4, "component")
});

const $$splitComponentImporter$3 = () => import('./route-BEglJoG6.mjs');
const Route$3 = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data,
      error
    } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({
      to: "/auth"
    });
    return {
      user: data.user
    };
  },
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});

const $$splitComponentImporter$2 = () => import('./index-DwLQkGxT.mjs');
const Route$2 = createFileRoute("/")({
  head: () => ({
    meta: [{
      title: "Orbita — Master every corner of the world"
    }, {
      name: "description",
      content: "195 countries. Every capital. Every flag. A cinematic geography mastery platform."
    }, {
      property: "og:title",
      content: "Orbita — Master every corner of the world"
    }, {
      property: "og:description",
      content: "A living atlas. 195 countries, every capital, every flag — explored from orbit."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});

const $$splitComponentImporter$1 = () => import('./account-DacT1ZyW.mjs');
const Route$1 = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [{
      title: "Account · Orbita"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});

const $$splitComponentImporter = () => import('./account.sync-CGL-EpaW.mjs');
const Route = createFileRoute("/_authenticated/account/sync")({
  head: () => ({
    meta: [{
      title: "Sync · Orbita"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter, "component")
});

const SpeedRoute = Route$d.update({
  id: "/speed",
  path: "/speed",
  getParentRoute: () => Route$e
});
const ResetPasswordRoute = Route$c.update({
  id: "/reset-password",
  path: "/reset-password",
  getParentRoute: () => Route$e
});
const ProgressRoute = Route$b.update({
  id: "/progress",
  path: "/progress",
  getParentRoute: () => Route$e
});
const NameRoute = Route$a.update({
  id: "/name",
  path: "/name",
  getParentRoute: () => Route$e
});
const FlagsRoute = Route$9.update({
  id: "/flags",
  path: "/flags",
  getParentRoute: () => Route$e
});
const FindRoute = Route$8.update({
  id: "/find",
  path: "/find",
  getParentRoute: () => Route$e
});
const ExplorerRoute = Route$7.update({
  id: "/explorer",
  path: "/explorer",
  getParentRoute: () => Route$e
});
const ChallengesRoute = Route$6.update({
  id: "/challenges",
  path: "/challenges",
  getParentRoute: () => Route$e
});
const CapitalsRoute = Route$5.update({
  id: "/capitals",
  path: "/capitals",
  getParentRoute: () => Route$e
});
const AuthRoute = Route$4.update({
  id: "/auth",
  path: "/auth",
  getParentRoute: () => Route$e
});
const AuthenticatedRouteRoute = Route$3.update({
  id: "/_authenticated",
  getParentRoute: () => Route$e
});
const IndexRoute = Route$2.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$e
});
const AuthenticatedAccountRoute = Route$1.update({
  id: "/account",
  path: "/account",
  getParentRoute: () => AuthenticatedRouteRoute
});
const AuthenticatedAccountSyncRoute = Route.update({
  id: "/sync",
  path: "/sync",
  getParentRoute: () => AuthenticatedAccountRoute
});
const AuthenticatedAccountRouteChildren = {
  AuthenticatedAccountSyncRoute
};
const AuthenticatedAccountRouteWithChildren = AuthenticatedAccountRoute._addFileChildren(AuthenticatedAccountRouteChildren);
const AuthenticatedRouteRouteChildren = {
  AuthenticatedAccountRoute: AuthenticatedAccountRouteWithChildren
};
const AuthenticatedRouteRouteWithChildren = AuthenticatedRouteRoute._addFileChildren(AuthenticatedRouteRouteChildren);
const rootRouteChildren = {
  IndexRoute,
  AuthenticatedRouteRoute: AuthenticatedRouteRouteWithChildren,
  AuthRoute,
  CapitalsRoute,
  ChallengesRoute,
  ExplorerRoute,
  FindRoute,
  FlagsRoute,
  NameRoute,
  ProgressRoute,
  ResetPasswordRoute,
  SpeedRoute
};
const routeTree = Route$e._addFileChildren(rootRouteChildren)._addFileTypes();

const getRouter = () => {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0
  });
  return router;
};

const router = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: 'Module' }));

export { Route$4 as R, authDebug as a, useSyncStore as b, cn as c, ensureUserProfile as e, router as r, useAuth as u };
