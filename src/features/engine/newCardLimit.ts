import { db } from "@/lib/db/orbita-db";

/** New concepts a user may start per local day, across all practice modes. */
export const MAX_NEW_PER_DAY = 10;

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** `new_cards_<YYYY-MM-DD>` for the local day of `nowMs` in `timeZone` (device zone by default). */
export function newCardsKey(
  nowMs: number,
  timeZone: string | undefined = deviceTimeZone(),
): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
  return `new_cards_${day}`;
}

function parseCount(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** New concepts already started today. A failed read counts as 0 so practice never goes blank. */
export async function readNewCardsToday(nowMs = Date.now()): Promise<number> {
  try {
    const row = await db().sync_meta.get(newCardsKey(nowMs));
    return parseCount(row?.value);
  } catch (e) {
    console.error("Could not read today's new-card count", e);
    return 0;
  }
}

// Increments are chained so two quick grades in this tab cannot read the same value.
let pending: Promise<unknown> = Promise.resolve();

/** Adds one to today's new-card count in sync_meta. */
export function incrementNewCardsToday(nowMs = Date.now()): Promise<void> {
  const key = newCardsKey(nowMs);
  const run = pending.then(async () => {
    const row = await db().sync_meta.get(key);
    await db().sync_meta.put({ key, value: String(parseCount(row?.value) + 1) });
  });
  pending = run.catch(() => {});
  return run;
}
