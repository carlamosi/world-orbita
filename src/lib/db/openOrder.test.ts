// @vitest-environment node
// createOrbitaDb must issue indexedDB.deleteDatabase BEFORE constructing the
// Dexie (which is what opens the database), once per db name.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const log: string[] = [];

vi.mock("dexie", () => {
  class FakeDexie {
    constructor(name: string) {
      log.push(`open:${name}`);
      // OrbitaDB re-declares its tables as class fields (which would reset
      // them to undefined after super()), so serve `meta` through a proxy.
      return new Proxy(this, {
        get: (t, p, r) => (p === "meta" ? { put: () => Promise.resolve() } : Reflect.get(t, p, r)),
        defineProperty: (t, p, d) => (p === "meta" ? true : Reflect.defineProperty(t, p, d)),
      });
    }
    version() {
      const chain = { stores: () => chain, upgrade: () => chain };
      return chain;
    }
  }
  return { default: FakeDexie };
});
vi.mock("./dbProvider", () => ({ ensureDb: vi.fn(), getDbSync: vi.fn(), getCurrent: vi.fn(), setCurrent: vi.fn() }));

import { createOrbitaDb } from "./orbita-db";

const g = globalThis as Record<string, unknown>;

class FakeStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

beforeEach(() => {
  log.length = 0;
  g.window = g;
  g.localStorage = new FakeStorage();
  g.indexedDB = { deleteDatabase: (n: string) => void log.push(`delete:${n}`) };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete g.window;
  delete g.localStorage;
  delete g.indexedDB;
});

describe("createOrbitaDb", () => {
  it("deletes before the first open of orbita-local and of orbita-<uid>, then never again", () => {
    createOrbitaDb("orbita-local");
    createOrbitaDb("orbita-local");
    createOrbitaDb("orbita-u1");
    createOrbitaDb("orbita-u1");
    expect(log).toEqual([
      "delete:orbita-local",
      "open:orbita-local",
      "open:orbita-local",
      "delete:orbita-u1",
      "open:orbita-u1",
      "open:orbita-u1",
    ]);
  });

  it("a throwing localStorage still opens the db", () => {
    g.localStorage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    expect(() => createOrbitaDb("orbita-local")).not.toThrow();
    expect(log).toEqual(["open:orbita-local"]);
  });
});
