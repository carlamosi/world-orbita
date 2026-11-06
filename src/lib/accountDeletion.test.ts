// @vitest-environment node
// Ruling 6b: delete_account now removes auth.users itself, so the server fn
// must not call auth.admin.deleteUser; the client then wipes Dexie and signs out.
import { describe, it, expect, vi } from "vitest";
import { runDeleteAccount } from "./account.functions";
import { finishAccountDeletion } from "./accountCleanup";

describe("deleteAccount server handler", () => {
  it("calls only the delete_account RPC", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async () => ({ error: null }));
    const supabase = { rpc, auth: { admin: { deleteUser } } };
    await expect(runDeleteAccount(supabase as never)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_account");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("surfaces an RPC error", async () => {
    const supabase = { rpc: vi.fn(async () => ({ error: { message: "boom" } })) };
    await expect(runDeleteAccount(supabase as never)).rejects.toThrow("boom");
  });
});

describe("finishAccountDeletion", () => {
  it("signs out, closes the user DB and deletes it, in that order", async () => {
    const calls: string[] = [];
    await finishAccountDeletion("u-1", {
      signOut: async () => void calls.push("signOut"),
      swapToGuest: async () => void calls.push("swap"),
      deleteDb: async (name: string) => void calls.push(`delete:${name}`),
    });
    expect(calls).toEqual(["signOut", "swap", "delete:orbita-u-1"]);
  });

  it("still deletes the local DB when sign-out fails", async () => {
    const deleteDb = vi.fn(async (_name: string) => {});
    await finishAccountDeletion("u-2", {
      signOut: async () => {
        throw new Error("offline");
      },
      swapToGuest: async () => {},
      deleteDb,
    });
    expect(deleteDb).toHaveBeenCalledWith("orbita-u-2");
  });
});
