import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface RpcClient {
  rpc: (fn: "delete_account") => PromiseLike<{ error: { message: string } | null }>;
}

/**
 * The `delete_account` RPC (SECURITY DEFINER) removes the caller's app rows
 * AND the auth.users row in one transaction. Do not also call
 * auth.admin.deleteUser: the user is already gone and it would fail with
 * "user not found" after a successful delete.
 */
export async function runDeleteAccount(supabase: RpcClient): Promise<{ ok: true }> {
  const { error } = await supabase.rpc("delete_account");
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Permanently delete the signed-in user's account. The client must then call
 * finishAccountDeletion (accountCleanup.ts) to sign out and wipe local data.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> =>
    runDeleteAccount(context.supabase as unknown as RpcClient),
  );
