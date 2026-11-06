// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SCHEMA_EPOCH,
  SCHEMA_EPOCH_KEY,
  DB_EPOCH_PREFIX,
  resetDbBeforeOpen,
  runLocalStorageEpochReset,
} from "./schemaEpoch";

class FakeStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const g = globalThis as Record<string, unknown>;
let ls: FakeStorage;
let deleted: string[];

beforeEach(() => {
  ls = new FakeStorage();
  deleted = [];
  g.window = g;
  g.localStorage = ls;
  g.indexedDB = { deleteDatabase: (n: string) => void deleted.push(n) };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete g.window;
  delete g.localStorage;
  delete g.indexedDB;
  vi.restoreAllMocks();
});

describe("per-db reset", () => {
  it("epoch reset wipes each old db once, with no databases() needed", () => {
    resetDbBeforeOpen("orbita-local");
    resetDbBeforeOpen("orbita-local");
    resetDbBeforeOpen("orbita-user-1");
    resetDbBeforeOpen("orbita-user-1");
    resetDbBeforeOpen("other-app");
    expect(deleted).toEqual(["orbita-local", "orbita-user-1"]);
    expect(ls.getItem(DB_EPOCH_PREFIX + "orbita-local")).toBe(String(SCHEMA_EPOCH));
  });

  it("a deletion error does not throw and is retried next time", () => {
    g.indexedDB = {
      deleteDatabase: () => {
        throw new Error("boom");
      },
    };
    expect(() => resetDbBeforeOpen("orbita-local")).not.toThrow();
    expect(ls.getItem(DB_EPOCH_PREFIX + "orbita-local")).toBeNull();
  });

  it("a broken localStorage does not throw and deletes nothing", () => {
    g.localStorage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    expect(() => resetDbBeforeOpen("orbita-local")).not.toThrow();
    expect(deleted).toEqual([]);
  });

  it("SSR (no window) is a no-op", () => {
    delete g.window;
    delete g.localStorage;
    delete g.indexedDB;
    expect(() => resetDbBeforeOpen("orbita-local")).not.toThrow();
    expect(() => runLocalStorageEpochReset()).not.toThrow();
  });
});

describe("localStorage reset", () => {
  it("wipes orbita keys once, keeping sb-* auth keys and per-db epoch keys", () => {
    ls.setItem("orbita_client_id", "x");
    ls.setItem("orbita.explorer.lastIso3", "ESP");
    ls.setItem("sb-abc-auth-token", "jwt");
    ls.setItem("unrelated", "keep");
    ls.setItem(DB_EPOCH_PREFIX + "orbita-local", "2");

    runLocalStorageEpochReset();
    expect(ls.getItem("orbita_client_id")).toBeNull();
    expect(ls.getItem("orbita.explorer.lastIso3")).toBeNull();
    expect(ls.getItem("sb-abc-auth-token")).toBe("jwt");
    expect(ls.getItem("unrelated")).toBe("keep");
    expect(ls.getItem(DB_EPOCH_PREFIX + "orbita-local")).toBe("2");
    expect(ls.getItem(SCHEMA_EPOCH_KEY)).toBe(String(SCHEMA_EPOCH));

    ls.setItem("orbita_client_id", "new");
    runLocalStorageEpochReset();
    expect(ls.getItem("orbita_client_id")).toBe("new");
  });

  it("a lower epoch also resets, and a broken localStorage does not throw", () => {
    ls.setItem(SCHEMA_EPOCH_KEY, "1");
    ls.setItem("orbita_x", "1");
    runLocalStorageEpochReset();
    expect(ls.getItem("orbita_x")).toBeNull();

    g.localStorage = {
      getItem() {
        throw new Error("denied");
      },
    };
    expect(() => runLocalStorageEpochReset()).not.toThrow();
  });
});
