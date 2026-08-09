// ─── Supabase Admin (Service-Role) Client — SERVER ONLY ──────────────────────
//
// SECURITY: This client bypasses Row Level Security.
// NEVER import this at module scope in client-reachable files (routes, *.tsx).
// Load it lazily inside server handlers:
//   const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
//
// Required env vars (Vercel → Settings → Environment Variables):
//   SUPABASE_URL              (same value as VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (never expose to client)

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseAdminClient() {
  const SUPABASE_URL = typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined;
  const SUPABASE_SERVICE_ROLE_KEY =
    typeof process !== "undefined" ? process.env?.SUPABASE_SERVICE_ROLE_KEY : undefined;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];

    // Do NOT throw at module scope — throw only when the client is first used.
    // This allows the module to be imported without crashing server startup.
    const message =
      `[Supabase Admin] Missing env var(s): ${missing.join(", ")}. ` +
      "Set them in Vercel → Settings → Environment Variables.";
    console.error(message);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role — bypasses RLS.
// SECURITY: Only use for trusted server-side operations; never expose to client code.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
