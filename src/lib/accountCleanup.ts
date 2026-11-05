/**
 * Client-side cleanup after a successful delete_account: sign out, close the
 * user's Dexie DB (swap to the guest DB) and delete it, so no local copy of a
 * deleted account survives on the device.
 */
export interface AccountCleanupDeps {
  signOut: () => Promise<void>;
  swapToGuest: () => Promise<void>;
  deleteDb: (name: string) => Promise<void>;
}

async function defaultDeps(): Promise<AccountCleanupDeps> {
  const [{ supabase }, { swap }, { default: Dexie }] = await Promise.all([
    import("@/integrations/supabase/client"),
    import("@/lib/db/dbProvider"),
    import("dexie"),
  ]);
  return {
    signOut: async () => {
      await supabase.auth.signOut();
    },
    swapToGuest: async () => {
      await swap(null);
    },
    deleteDb: async (name) => {
      await Dexie.delete(name);
    },
  };
}

export async function finishAccountDeletion(
  userId: string,
  deps?: AccountCleanupDeps,
): Promise<void> {
  const d = deps ?? (await defaultDeps());
  try {
    await d.signOut();
  } catch (e) {
    // The account is already gone server-side; still wipe the local copy.
    console.warn("[account] sign-out after delete failed", e);
  }
  await d.swapToGuest();
  await d.deleteDb(`orbita-${userId}`);
}
