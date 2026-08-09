/**
 * orbita-auth.ts
 *
 * Native Supabase OAuth wrapper — no Lovable dependency.
 * Replaces the old @lovable.dev/cloud-auth-js integration.
 */
import { supabase } from "../supabase/client";

type OAuthProvider = "google" | "apple" | "github" | "twitter";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const orbitaAuth = {
  auth: {
    signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin,
          queryParams: opts?.extraParams,
        },
      });

      if (error) return { error };
      if (data.url) {
        window.location.href = data.url;
        return { redirected: true };
      }
      return { redirected: false };
    },
  },
};
