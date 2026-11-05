// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, defaultMigrationFiles, type TestDb } from "@/test/pglite";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("pglite harness", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  }, 60_000);

  it("applies all current migrations", () => {
    expect(defaultMigrationFiles()).toHaveLength(10);
  });

  it("sync_pull as a user returns an object with entity keys", async () => {
    await t.asUser(A);
    const r = await t.call<Record<string, unknown>>("sync_pull", { _cursors: {}, _limit: 10 });
    expect(typeof r).toBe("object");
    expect(Object.keys(r).length).toBeGreaterThan(0);
  });

  it("anon cannot call sync_push", async () => {
    await t.asAnon();
    await expect(t.call("sync_push", { _mutations: [] })).rejects.toThrow(/permission denied|unauthenticated/i);
  });

  it("RLS hides user A rows from user B", async () => {
    await t.asUser(A);
    await t.db.query("insert into public.unlocks (user_id, key) values ($1, 'x')", [A]);
    const mine = await t.db.query("select * from public.unlocks");
    expect(mine.rows).toHaveLength(1);
    await t.asUser(B);
    const theirs = await t.db.query("select * from public.unlocks");
    expect(theirs.rows).toHaveLength(0);
    await t.asService();
  });
});
