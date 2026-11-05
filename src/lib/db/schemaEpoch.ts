/**
 * One-time local reset for the Supabase v2 schema.
 *
 * The v2 server contract (epoch-ms dates, composite cursors) is incompatible
 * with data written by v1 clients (ISO dates, old cursors, old outbox rows).
 * When the stored epoch is missing or lower than SCHEMA_EPOCH we delete every
 * IndexedDB database named `orbita*` and every `orbita*` localStorage key, then
 * store the new epoch. Never throws, never blocks rendering: callers may
 * `void` the promise, but should await it before opening a DB or starting the
 * sync workers.
 */
export const SCHEMA_EPOCH = 2;
export const SCHEMA_EPOCH_KEY = "orbita_schema_epoch";

const PREFIX = "orbita";
/** Used when indexedDB.databases() is unavailable (older Firefox/Safari). */
const KNOWN_DB_NAMES = ["orbita-local"];

function readEpoch(): number {
  try {
    const n = Number(localStorage.getItem(SCHEMA_EPOCH_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function listDbNames(): Promise<string[]> {
  try {
    if (typeof indexedDB.databases === "function") {
      const all = await indexedDB.databases();
      return all.map((d) => d.name ?? "").filter((n) => n.startsWith(PREFIX));
    }
  } catch (e) {
    console.warn("[schemaEpoch] databases() failed, using known names:", e);
  }
  return [...KNOWN_DB_NAMES];
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn("[schemaEpoch] could not delete", name);
        resolve();
      };
      // Another tab still holds it open: it is deleted once that tab closes.
      req.onblocked = () => resolve();
    } catch (e) {
      console.warn("[schemaEpoch] could not delete", name, e);
      resolve();
    }
  });
}

function wipeLocalStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== SCHEMA_EPOCH_KEY) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch (e) {
    console.warn("[schemaEpoch] localStorage wipe failed:", e);
  }
}

export async function runSchemaEpochReset(): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    if (readEpoch() >= SCHEMA_EPOCH) return;

    const names = await listDbNames();
    await Promise.all(names.map(deleteDb));
    wipeLocalStorage();
    try {
      localStorage.setItem(SCHEMA_EPOCH_KEY, String(SCHEMA_EPOCH));
    } catch (e) {
      console.warn("[schemaEpoch] could not store epoch:", e);
    }
  } catch (e) {
    console.warn("[schemaEpoch] reset failed:", e);
  }
}
