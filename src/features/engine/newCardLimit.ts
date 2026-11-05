import { db } from "@/lib/db/orbita-db";
import { parseConceptId } from "@/lib/fsrs/concept";

/** New concepts a user may start per local day, per bucket (domain:skill:subMode). */
export const MAX_NEW_PER_DAY = 10;

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** `YYYY-MM-DD` of `nowMs` in `timeZone` (device zone by default). */
export function localDay(nowMs: number, timeZone: string | undefined = deviceTimeZone()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Budget bucket of a concept: `<domain>:<skill>:<subMode>`, parsed from its
 * own conceptId, so Spain provinces and world location:find never share one.
 */
export function newCardBucket(conceptId: string): string {
  const { domain, skill, subMode } = parseConceptId(conceptId);
  return `${domain}:${skill}:${subMode ?? skill}`;
}

/** `new_cards_<YYYY-MM-DD>_<domain>:<skill>:<subMode>` */
export function newCardsKey(
  bucket: string,
  nowMs: number,
  timeZone: string | undefined = deviceTimeZone(),
): string {
  return `new_cards_${localDay(nowMs, timeZone)}_${bucket}`;
}

function parseCount(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * New concepts already started today in `bucket`. A failed read counts as 0
 * so practice never goes blank.
 */
export async function readNewCardsToday(bucket: string, nowMs = Date.now()): Promise<number> {
  try {
    const row = await db().sync_meta.get(newCardsKey(bucket, nowMs));
    return parseCount(row?.value);
  } catch (e) {
    console.error("Could not read today's new-card count", e);
    return 0;
  }
}

// Increments are chained so two quick grades in this tab cannot read the same value.
let pending: Promise<unknown> = Promise.resolve();

/** Adds one to today's new-card count of `bucket` in sync_meta. */
export function incrementNewCardsToday(bucket: string, nowMs = Date.now()): Promise<void> {
  const key = newCardsKey(bucket, nowMs);
  const run = pending.then(async () => {
    const row = await db().sync_meta.get(key);
    await db().sync_meta.put({ key, value: String(parseCount(row?.value) + 1) });
  });
  pending = run.catch(() => {});
  return run;
}
