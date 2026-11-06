/**
 * One-time local reset for the Supabase v2 schema.
 *
 * The v2 server contract (epoch-ms dates, composite cursors) is incompatible
 * with data written by v1 clients (ISO dates, old cursors, old outbox rows).
 *
 * Two synchronous pieces, neither of which can block or throw:
 *
 * 1. resetDbBeforeOpen(name): called by createOrbitaDb right before
 *    `new Dexie(name)`. The first time THIS browser opens a given `orbita*`
 *    database it fires indexedDB.deleteDatabase(name) and records
 *    `orbita_epoch_db:<name>` = SCHEMA_EPOCH. IndexedDB runs requests for one
 *    name in order, so the open that follows waits for the delete. Because it
 *    happens per database at open time it covers every user DB (no need to
 *    enumerate with indexedDB.databases()) and cannot race a lazy open.
 *
 * 2. runLocalStorageEpochReset(): at startup (module level in __root), when
 *    `orbita_schema_epoch` is missing or lower, removes the `orbita*`
 *    localStorage keys (not the epoch keys, not sb-* auth keys) and stores the
 *    epoch.
 */
export const SCHEMA_EPOCH = 2;
export const SCHEMA_EPOCH_KEY = "orbita_schema_epoch";
export const DB_EPOCH_PREFIX = "orbita_epoch_db:";

const PREFIX = "orbita";

export function resetDbBeforeOpen(name: string): void {
  try {
    if (typeof window === "undefined" || !name.startsWith(PREFIX)) return;
    const key = DB_EPOCH_PREFIX + name;
    // Without a working localStorage we cannot remember the reset, and would
    // delete on every open: skip it entirely.
    if (localStorage.getItem(key) === String(SCHEMA_EPOCH)) return;
    indexedDB.deleteDatabase(name); // fire and forget
    localStorage.setItem(key, String(SCHEMA_EPOCH));
  } catch (e) {
    console.warn("[schemaEpoch] per-db reset skipped:", e);
  }
}

export function runLocalStorageEpochReset(): void {
  try {
    if (typeof window === "undefined") return;
    const stored = Number(localStorage.getItem(SCHEMA_EPOCH_KEY));
    if (Number.isFinite(stored) && stored >= SCHEMA_EPOCH) return;

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith(PREFIX) &&
        k !== SCHEMA_EPOCH_KEY &&
        !k.startsWith(DB_EPOCH_PREFIX)
      ) {
        keys.push(k);
      }
    }
    for (const k of keys) localStorage.removeItem(k);
    localStorage.setItem(SCHEMA_EPOCH_KEY, String(SCHEMA_EPOCH));
  } catch (e) {
    console.warn("[schemaEpoch] localStorage reset failed:", e);
  }
}
