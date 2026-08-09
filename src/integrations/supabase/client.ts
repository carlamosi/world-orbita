// ─── Supabase Browser Client ────────────────────────────────────────────────
//
// This module is imported by both browser and server bundles.
// Rules:
//  • Client creation is lazy (inside Proxy) so module-level import never throws.
//  • On SSR the supabase client is NEVER initialised here — auth-middleware.ts
//    creates its own per-request client using process.env.
//  • If env vars are missing we log a warning and return a no-op stub so SSR
//    can still render public pages without crashing.
//
// Usage:
//   import { supabase } from "@/integrations/supabase/client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const IS_SERVER = typeof window === "undefined";

function createSupabaseClient() {
  // import.meta.env is replaced at build time by Vite (browser bundle).
  // process.env is available at runtime in the SSR/Node context.
  const SUPABASE_URL =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : undefined) ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);

  const SUPABASE_PUBLISHABLE_KEY =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["VITE_SUPABASE_URL / SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY"] : []),
    ];

    if (IS_SERVER) {
      // On the server we do NOT throw — SSR must be able to render public
      // pages even if Supabase is not yet configured. Auth-protected server
      // functions use auth-middleware.ts which validates env independently.
      console.warn(
        `[Supabase] Missing env var(s) on server: ${missing.join(", ")}. ` +
          "Returning placeholder client. Set vars in Vercel → Settings → Environment Variables.",
      );
      // Return a dummy client that surfaces a clear error on first real call.
      // createClient accepts any non-empty strings; real calls will get a 401.
      return createClient<Database>("https://placeholder.supabase.co", "placeholder-key", {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
    }

    // In the browser we DO throw — the page cannot function without Supabase.
    const message =
      `Missing Supabase environment variable(s): ${missing.join(", ")}. ` +
      "Check Vercel → Settings → Environment Variables.";
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // localStorage is only available in the browser.
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
//   import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
