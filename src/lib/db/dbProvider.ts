/**
 * Per-user Dexie DB provider.
 *
 * DB name pattern: `orbita-${serverUserId ?? 'local'}`. Anonymous users use
 * `orbita-local`. On sign-in, we swap to a per-user DB; the guest data is merged
 * afterwards by auth/migrateGuestProgress.
 *
 * The shared singleton ref lives here. `orbita-db.ts#db()` reads it and
 * initialises a default local DB synchronously if none exists yet.
 */
import { createOrbitaDb, type OrbitaDB } from "./orbita-db";

type Listener = (db: OrbitaDB) => void;

interface State {
  current: OrbitaDB | null;
  name: string;
  listeners: Set<Listener>;
}

const state: State = {
  current: null,
  name: "orbita-local",
  listeners: new Set(),
};

let inflightCycle: Promise<unknown> = Promise.resolve();
/** Max wait for in-flight cycles; past it the cycles' moved(name) guards abort them. */
export const SWAP_WAIT_MS = 10_000;
let pending: { name: string; promise: Promise<OrbitaDB> } | null = null;

/** Register a sync cycle so swap() waits for it before changing DB. Never rejects the wait. */
export function trackCycle<T>(cycle: Promise<T>): Promise<T> {
  inflightCycle = Promise.all([inflightCycle, cycle.catch(() => {})]);
  return cycle;
}

export function getCurrent(): OrbitaDB | null {
  return state.current;
}

export function setCurrent(db: OrbitaDB, name: string) {
  state.current = db;
  state.name = name;
}

export function getDbSync(): OrbitaDB {
  if (!state.current) throw new Error("Orbita DB not initialised");
  return state.current;
}

export async function ensureDb(): Promise<OrbitaDB> {
  if (state.current) return state.current;
  state.current = createOrbitaDb(state.name);
  return state.current;
}

export function swap(userId: string | null): Promise<OrbitaDB> {
  const next = `orbita-${userId ?? "local"}`;
  // Single flight: a second swap to the same DB (e.g. SIGNED_OUT plus the
  // menu's own swap(null)) joins the first instead of opening another instance.
  if (pending?.name === next) return pending.promise;
  const promise = doSwap(next).finally(() => {
    if (pending?.promise === promise) pending = null;
  });
  pending = { name: next, promise };
  return promise;
}

async function doSwap(next: string): Promise<OrbitaDB> {
  if (state.current && state.name === next) return state.current;

  const prev = state.current;
  const nextDb = createOrbitaDb(next);

  // Let in-flight sync cycles finish on their DB. Loop until no new cycle was
  // registered meanwhile; nothing awaits between the loop and the switch.
  // Bounded: a hung push must not block sign-out or account deletion.
  const deadline = Date.now() + SWAP_WAIT_MS;
  let waited: Promise<unknown>;
  do {
    waited = inflightCycle;
    const left = deadline - Date.now();
    if (left <= 0) break;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([waited, new Promise((r) => (timer = setTimeout(r, left)))]);
    clearTimeout(timer);
  } while (waited !== inflightCycle);

  if (prev) {
    try { prev.close(); } catch { /* ignore */ }
  }

  state.name = next;
  state.current = nextDb;
  for (const l of state.listeners) {
    try { l(state.current); } catch { /* ignore */ }
  }
  return state.current;
}

export function onSwap(fn: Listener): () => void {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function currentDbName(): string {
  return state.name;
}
