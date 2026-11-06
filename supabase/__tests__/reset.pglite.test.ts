// @vitest-environment node
// reset.sql must take a v1 database (archived migrations + data) back to
// empty, so the v2 baseline applies cleanly. It must also be idempotent.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTestDb, archiveMigrationFiles, defaultMigrationFiles } from "@/test/pglite";

const RESET = readFileSync(path.resolve(__dirname, "../reset/2026-11-06-reset.sql"), "utf8");
const BASELINE = readFileSync(defaultMigrationFiles()[0], "utf8");
const USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function v1WithData() {
  const t = await createTestDb(archiveMigrationFiles());
  await t.db.exec(`insert into auth.users (id, email) values ('${USER}', 'a@b.c')`);
  await t.db.exec(`insert into public.unlocks (user_id, key, progress) values ('${USER}', 'k', 1)`);
  return t;
}

describe("reset.sql", { timeout: 60_000 }, () => {
  it("wipes a v1 database and the v2 baseline then works", async () => {
    const t = await v1WithData();
    await t.db.exec(RESET);

    const users = await t.db.query<{ n: number }>("select count(*)::int n from auth.users");
    expect(users.rows[0].n).toBe(0);
    const tables = await t.db.query<{ n: number }>(
      "select count(*)::int n from pg_tables where schemaname = 'public'",
    );
    expect(tables.rows[0].n).toBe(0);
    const fns = await t.db.query<{ n: number }>(
      `select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
    );
    expect(fns.rows[0].n).toBe(0);

    await t.db.exec(BASELINE);

    const uid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await t.asUser(uid);
    const push = await t.call("sync_push", {
      _mutations: [
        {
          op_id: crypto.randomUUID(),
          entity: "unlocks",
          op: "upsert",
          payload: { key: "first", progress: 1, unlocked_at: Date.UTC(2026, 10, 5) },
        },
      ],
    });
    expect(JSON.stringify(push)).not.toMatch(/invalid_payload|unknown_entity/);
    const pull = await t.call("sync_pull", { _cursors: {}, _limit: 50 });
    expect(JSON.stringify(pull)).toContain("first");

    await t.asAnon();
    await expect(t.call("sync_pull", { _cursors: {} })).rejects.toThrow(/permission denied/);
  });

  it("is safe to run twice, and on an already empty database", async () => {
    const t = await v1WithData();
    await t.db.exec(RESET);
    await t.db.exec(RESET);
    const fresh = await createTestDb([]);
    await fresh.db.exec(RESET);
    await fresh.db.exec(BASELINE);
    await fresh.db.exec(RESET);
    await fresh.db.exec(RESET);
  });

  it("clears supabase_migrations.schema_migrations when it exists", async () => {
    const t = await v1WithData();
    await t.db.exec(`
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (version text primary key, name text);
      insert into supabase_migrations.schema_migrations values ('20260616184030','x');
    `);
    await t.db.exec(RESET);
    const r = await t.db.query<{ n: number }>(
      "select count(*)::int n from supabase_migrations.schema_migrations",
    );
    expect(r.rows[0].n).toBe(0);
  });
});
