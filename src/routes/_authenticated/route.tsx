import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: {} });
    return { user: data.user };
  },
  pendingComponent: () => (
    <div className="flex h-dvh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-cyan" />
    </div>
  ),
  errorComponent: () => (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm text-coral">Failed to load account</p>
    </div>
  ),
  component: () => <Outlet />,
});
