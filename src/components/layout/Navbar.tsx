import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SyncPill } from "@/features/sync/SyncPill";
import { AccountMenu } from "@/features/sync/AccountMenu";
import { useDueTodayCount } from "@/hooks/useDueTodayCount";

const NAV = [
  { to: "/locate", label: "Locate" },
  { to: "/flags", label: "Flags" },
  { to: "/capitals", label: "Capitals" },
  { to: "/geography", label: "Geography" },
  { to: "/speed", label: "Speed" },
  { to: "/challenges", label: "Challenges" },
  { to: "/progress", label: "Progress" },
] as const;

function OrbitalLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <radialGradient id="lg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6c63ff" />
          <stop offset="100%" stopColor="#050508" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="7" fill="url(#lg)" />
      <ellipse
        cx="16"
        cy="16"
        rx="13.5"
        ry="5"
        stroke="#00d4ff"
        strokeOpacity="0.65"
        strokeWidth="1"
        transform="rotate(-22 16 16)"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="13.5"
        ry="5"
        stroke="#6c63ff"
        strokeOpacity="0.5"
        strokeWidth="1"
        transform="rotate(28 16 16)"
      />
      <circle cx="29" cy="9" r="1.3" fill="#00ffb2" />
    </svg>
  );
}

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const dueCount = useDueTodayCount();

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-4">
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
        className="glass rounded-full pl-4 pr-2 py-2 flex items-center gap-2 max-w-[min(96vw,1080px)] w-full"
      >
        <Link to="/" className="flex items-center gap-2 px-2 group">
          <OrbitalLogo />
          <span className="font-display font-semibold tracking-tight text-white text-[15px]">
            Orbita
          </span>
        </Link>
        <div className="ml-2 flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {/* Due Today — always first, prominent */}
          <Link
            to="/review"
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] rounded-full transition-colors shrink-0",
              pathname.startsWith("/review") ? "text-white" : "text-white/55 hover:text-white",
            )}
          >
            <span>Due Today</span>
            {dueCount > 0 && (
              <motion.span
                key={dueCount}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--cyan)] text-black text-[10px] font-bold font-mono leading-none"
              >
                {dueCount > 99 ? "99+" : dueCount}
              </motion.span>
            )}
            {pathname.startsWith("/review") && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 -z-10 rounded-full bg-white/8 border border-white/10 shadow-[0_0_12px_rgba(0,212,255,0.25),0_0_24px_rgba(0,212,255,0.15)]"
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              />
            )}
          </Link>

          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative inline-flex items-center justify-center px-3 py-1.5 text-[13px] rounded-full transition-colors shrink-0",
                  active ? "text-white" : "text-white/55 hover:text-white",
                )}
              >
                <span>{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-full bg-white/8 border border-white/10 shadow-[0_0_12px_rgba(0,212,255,0.25),0_0_24px_rgba(0,212,255,0.15)]"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SyncPill />
          <Link
            to="/explorer"
            className="hidden sm:inline-flex items-center text-[13px] font-medium text-white rounded-full px-4 py-1.5 bg-white/10 border border-white/15 hover:bg-white/15"
          >
            Explorer
          </Link>
          <AccountMenu />
        </div>
      </motion.nav>
    </header>
  );
}

