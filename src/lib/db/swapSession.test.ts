// @vitest-environment jsdom
// Overlapping swaps: only the latest one may mark the session signed in.
import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { swapForSession, getCurrent, trackCycle, SWAP_WAIT_MS } from "./dbProvider";

describe("swapForSession", () => {
  it("B then sign-out ends with signedIn false", async () => {
    vi.useFakeTimers();
    const setSignedIn = vi.fn();
    // A's push hangs, so both swaps wait for it.
    trackCycle(new Promise(() => {}));
    const b = swapForSession(crypto.randomUUID(), setSignedIn);
    const out = swapForSession(null, setSignedIn);
    await vi.advanceTimersByTimeAsync(SWAP_WAIT_MS + 10);
    await Promise.all([b, out]);
    vi.useRealTimers();
    expect(getCurrent()?.name).toBe("orbita-local");
    expect(setSignedIn).not.toHaveBeenCalledWith(true);
    expect(setSignedIn).toHaveBeenLastCalledWith(false);
  });
});
