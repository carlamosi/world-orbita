// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SCHEMA_EPOCH, SCHEMA_EPOCH_KEY, runSchemaEpochReset } from "./schemaEpoch";

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

function fakeIdb(names: string[], failOn?: string) {
  const dbs = new Set(names);
  const deleted: string[] = [];
  return {
    dbs,
    deleted,
    databases: (async () => [...dbs].map((name) => ({ name }))) as unknown,
    deleteDatabase: (name: string) => {
      const req: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
      setTimeout(() => {
        if (name === failOn) return req.onerror?.();
        dbs.delete(name);
        deleted.push(name);
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

const g = globalThis as Record<string, unknown>;
let ls: FakeStorage;

beforeEach(() => {
  ls = new FakeStorage();
  g.window = g;
  g.localStorage = ls;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete g.window;
  delete g.localStorage;
  delete g.indexedDB;
  vi.restoreAllMocks();
});

describe("schema epoch", () => {
  it("epoch reset wipes old dbs once", async () => {
    const idb = fakeIdb(["orbita-local", "orbita-user-1", "other-app"]);
    g.indexedDB = idb;
    ls.setItem("orbita_client_id", "x");
    ls.setItem("orbita.explorer.lastIso3", "ESP");
    ls.setItem("unrelated", "keep");

    await runSchemaEpochReset();
    expect(idb.deleted.sort()).toEqual(["orbita-local", "orbita-user-1"]);
    expect(idb.dbs.has("other-app")).toBe(true);
    expect(ls.getItem("orbita_client_id")).toBeNull();
    expect(ls.getItem("orbita.explorer.lastIso3")).toBeNull();
    expect(ls.getItem("unrelated")).toBe("keep");
    expect(ls.getItem(SCHEMA_EPOCH_KEY)).toBe(String(SCHEMA_EPOCH));

    // second call: nothing happens, new data survives
    idb.dbs.add("orbita-local");
    ls.setItem("orbita_client_id", "new");
    idb.deleted.length = 0;
    await runSchemaEpochReset();
    expect(idb.deleted).toEqual([]);
    expect(ls.getItem("orbita_client_id")).toBe("new");
  });

  it("falls back to the known names when indexedDB.databases is missing", async () => {
    const idb = fakeIdb(["orbita-local"]);
    idb.databases = undefined;
    g.indexedDB = idb;
    await runSchemaEpochReset();
    expect(idb.deleted).toContain("orbita-local");
  });

  it("a lower epoch also resets", async () => {
    const idb = fakeIdb(["orbita-local"]);
    g.indexedDB = idb;
    ls.setItem(SCHEMA_EPOCH_KEY, "1");
    await runSchemaEpochReset();
    expect(idb.deleted).toEqual(["orbita-local"]);
  });

  it("a deletion error does not throw", async () => {
    const idb = fakeIdb(["orbita-local", "orbita-u"], "orbita-local");
    g.indexedDB = idb;
    await expect(runSchemaEpochReset()).resolves.toBeUndefined();
    expect(idb.deleted).toEqual(["orbita-u"]);
  });

  it("a broken localStorage does not throw", async () => {
    g.indexedDB = fakeIdb([]);
    g.localStorage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
      key() {
        return null;
      },
      length: 0,
    };
    await expect(runSchemaEpochReset()).resolves.toBeUndefined();
  });

  it("SSR (no window) is a no-op", async () => {
    delete g.window;
    delete g.localStorage;
    await expect(runSchemaEpochReset()).resolves.toBeUndefined();
  });
});
