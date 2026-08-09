// ─── Supabase Auth Middleware ─────────────────────────────────────────────────
//
// Validates the Bearer token on inbound server-function RPCs.
// Returns HTTP 401 (not a thrown Error) for all auth failures so h3 / Nitro
// emits a proper 401 JSON response instead of swallowing the error as a 500.
//
// Usage:
//   createServerFn().middleware([requireSupabaseAuth]).handler(async ({ context }) => {
//     context.supabase  // authenticated Supabase client (RLS-scoped to user)
//     context.userId    // string UUID
//     context.claims    // JWT payload
//   })

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function getSupabaseEnv() {
  const SUPABASE_URL = typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined;
  const SUPABASE_PUBLISHABLE_KEY =
    typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message =
      `[Supabase Auth] Missing env var(s): ${missing.join(", ")}. ` +
      "Set them in Vercel → Settings → Environment Variables.";
    console.error(message);
    // Return a structured error so the handler can emit a proper HTTP response.
    return { error: message } as const;
  }

  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } as const;
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const env = getSupabaseEnv();
    if ("error" in env) {
      // Misconfigured server — surface a 503 rather than a cryptic 500.
      throw Object.assign(new Error(env.error), { statusCode: 503 });
    }

    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env;

    const request = getRequest();

    if (!request?.headers) {
      throw Object.assign(new Error("Unauthorized: No request headers available"), {
        statusCode: 401,
      });
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw Object.assign(new Error("Unauthorized: No authorization header provided"), {
        statusCode: 401,
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw Object.assign(new Error("Unauthorized: Only Bearer tokens are supported"), {
        statusCode: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw Object.assign(new Error("Unauthorized: No token provided"), { statusCode: 401 });
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw Object.assign(new Error("Unauthorized: Invalid token"), { statusCode: 401 });
    }

    if (!data.user.id) {
      throw Object.assign(new Error("Unauthorized: No user ID found in token"), {
        statusCode: 401,
      });
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        user: data.user,
      },
    });
  },
);
