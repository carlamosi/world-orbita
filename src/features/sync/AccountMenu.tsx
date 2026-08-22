import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncStore } from "@/lib/sync/useSyncStore";
import {
  User,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CloudOff,
  LogOut,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const { user, signedIn } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const status = useSyncStore((s) => s.status);
  const queued = useSyncStore((s) => s.queued);

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_flag")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  if (!signedIn) {
    return (
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/90 hover:text-white px-3.5 py-1.5 rounded-full border border-neon/30 bg-neon/10 hover:bg-neon/20 shadow-[0_0_16px_-4px_color-mix(in_oklab,var(--neon)_30%,transparent)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        title="Create an account to sync your progress"
      >
        <Sparkles className="size-3.5 text-neon animate-pulse" aria-hidden />
        <span>Save progress</span>
      </Link>
    );
  }

  const displayName =
    profileQ.data?.display_name?.trim() ||
    user?.email?.split("@")[0] ||
    "Explorer";
  const initial = displayName[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "O";

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    const { swap } = await import("@/lib/db/dbProvider");
    await swap(null);
    router.navigate({ to: "/", replace: true });
  };

  // Sync state metadata
  const syncInfo = (() => {
    if (status === "syncing") {
      return {
        label: "Syncing progress…",
        icon: RefreshCw,
        color: "text-cyan",
        bg: "bg-cyan/10 border-cyan/20",
        spin: true,
      };
    }
    if (status === "offline") {
      return {
        label: "Offline mode",
        icon: CloudOff,
        color: "text-white/50",
        bg: "bg-white/5 border-white/10",
        spin: false,
      };
    }
    if (status === "error") {
      return {
        label: "Sync issue",
        icon: AlertCircle,
        color: "text-coral",
        bg: "bg-coral/10 border-coral/20",
        spin: false,
      };
    }
    if (status === "queued" && queued > 0) {
      return {
        label: `${queued} change${queued === 1 ? "" : "s"} queued`,
        icon: RefreshCw,
        color: "text-amber-400",
        bg: "bg-amber-400/10 border-amber-400/20",
        spin: false,
      };
    }
    return {
      label: "All synced",
      icon: CheckCircle2,
      color: "text-neon",
      bg: "bg-neon/10 border-neon/20",
      spin: false,
    };
  })();

  const SyncIcon = syncInfo.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 py-1 text-[12px] text-white/85 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
          aria-label="User account menu"
        >
          <span className="size-6 grid place-items-center rounded-full bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 text-[11px] font-bold text-white shadow-sm ring-1 ring-white/20">
            {initial}
          </span>
          <span className="hidden sm:inline-block font-medium truncate max-w-[130px]">
            {displayName}
          </span>
          <span className={cn("size-2 rounded-full", syncInfo.bg, syncInfo.color === "text-neon" ? "bg-neon shadow-[0_0_8px_var(--neon)]" : syncInfo.color === "text-cyan" ? "bg-cyan animate-ping" : "bg-white/40")} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 p-2 rounded-2xl glass-strong border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        {/* User Identity Header */}
        <div className="px-2.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 mb-1.5 flex items-center gap-3">
          <div className="size-9 shrink-0 grid place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 text-sm font-bold text-white shadow-md ring-1 ring-white/20">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[13px] font-semibold text-white truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-white/45 truncate mt-0.5" title={user?.email}>
              {user?.email}
            </div>
          </div>
        </div>

        {/* Sync Status Tile */}
        <DropdownMenuItem asChild>
          <Link
            to="/account/sync"
            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-white/75 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className={cn("grid place-items-center size-5 rounded-md border", syncInfo.bg, syncInfo.color)}>
                <SyncIcon className={cn("size-3", syncInfo.spin && "animate-spin")} />
              </span>
              <span className="font-medium">{syncInfo.label}</span>
            </div>
            <ChevronRight className="size-3.5 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </DropdownMenuItem>

        {/* Navigation Items */}
        <DropdownMenuItem asChild>
          <Link
            to="/account"
            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-white/75 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="grid place-items-center size-5 rounded-md bg-white/5 border border-white/10 text-white/70 group-hover:text-white">
                <User className="size-3" />
              </span>
              <span>Account & Profile</span>
            </div>
            <ChevronRight className="size-3.5 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 bg-white/10" />

        {/* Sign Out */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-rose-300/90 hover:text-rose-200 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="size-3.5 text-rose-400" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

