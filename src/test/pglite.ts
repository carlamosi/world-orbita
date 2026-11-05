// PGlite harness: applies the Supabase migrations in-process so SQL can be
// tested without any real database. Supabase-specific pieces (auth schema,
// auth.uid(), roles) are stubbed below.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");
/** The pre-v2 migrations, kept unapplied for reference and for RED runs. */
export const ARCHIVE_MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations_archive");

// gen_random_uuid() is built into Postgres 13+ (PGlite runs 17), so pgcrypto is not needed.
const STUBS = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

// Supabase default privileges: objects created later in public are open to the API roles.
const SUPABASE_DEFAULT_GRANTS = `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFilesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
}

export function defaultMigrationFiles(): string[] {
  return migrationFilesIn(MIGRATIONS_DIR);
}

export function archiveMigrationFiles(): string[] {
  return migrationFilesIn(ARCHIVE_MIGRATIONS_DIR);
}

export interface CreateTestDbOptions {
  /**
   * Emulate Supabase's default privileges (every new table/function in public
   * granted to anon/authenticated/service_role). Default true. Pass false to
   * check that a schema works with only its own explicit grants.
   */
  supabaseDefaultGrants?: boolean;
}

function literal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT_RE = /^[a-z_][a-z0-9_]*$/i;

export interface TestDb {
  db: PGlite;
  asUser(uid: string): Promise<void>;
  asAnon(): Promise<void>;
  asService(): Promise<void>;
  call<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
}

export async function createTestDb(
  files: string[] = defaultMigrationFiles(),
  opts: CreateTestDbOptions = {},
): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(STUBS);
  if (opts.supabaseDefaultGrants ?? true) await db.exec(SUPABASE_DEFAULT_GRANTS);
  for (const f of files) {
    try {
      // Some migrations start with a UTF-8 BOM, which Postgres rejects when sent via exec.
      await db.exec(readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      throw new Error(`Migration failed: ${path.basename(f)}: ${(e as Error).message}`);
    }
  }

  const reset = async () => {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  };

  return {
    db,
    async asUser(uid) {
      if (!UUID_RE.test(uid)) throw new Error(`asUser: invalid uuid ${uid}`);
      await reset();
      await db.query(
        "insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing",
        [uid, `${uid}@test.local`],
      );
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`,
      );
    },
    async asAnon() {
      await reset();
      await db.exec("set role anon");
    },
    async asService() {
      await reset();
    },
    async call<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!IDENT_RE.test(fn)) throw new Error(`call: invalid function name ${fn}`);
      const named = Object.entries(args)
        .map(([k, v]) => {
          if (!IDENT_RE.test(k)) throw new Error(`call: invalid arg name ${k}`);
          return `${k} => ${literal(v)}`;
        })
        .join(", ");
      const res = await db.query<{ r: T }>(`select to_jsonb(public.${fn}(${named})) as r`);
      return res.rows[0].r;
    },
  };
}
