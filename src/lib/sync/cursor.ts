/**
 * Pull cursors for the v2 contract.
 *
 * The server cursor is an opaque string "<epoch_ms>|<pk>". It is stored and
 * resent as-is, with one exception: the FIRST page of each pull cycle moves
 * the cursor back by PULL_OVERLAP_MS, so rows committed late with an older
 * updated_at (SQL-4) are re-read. Applying pulled rows is idempotent, so the
 * overlap is harmless. Continuation pages (has_more) never overlap.
 */
export const PULL_OVERLAP_MS = 15_000;

/**
 * The lowest pk we can name for every entity (uuid or text). The server
 * treats an empty pk as an unparseable cursor (full re-pull), so instead the
 * ms part is moved back one extra ms: every row with updated_at >=
 * stored - PULL_OVERLAP_MS is re-read regardless of its pk.
 */
const MIN_PK = "00000000-0000-0000-0000-000000000000";

/** The ms prefix of a server cursor, or null if it is not one. */
export function cursorMs(cursor: string | null | undefined): number | null {
  if (!cursor) return null;
  const m = /^(\d{1,15})\|./.exec(cursor);
  return m ? Number(m[1]) : null;
}

/** First-page cursor: moved back by the overlap. Unparseable cursors pass through. */
export function overlapCursor(cursor: string | null, overlapMs = PULL_OVERLAP_MS): string | null {
  const ms = cursorMs(cursor);
  if (ms == null) return cursor;
  return `${Math.max(0, ms - overlapMs - 1)}|${MIN_PK}`;
}

/**
 * The cursor to persist after a page. A page read from an overlapped cursor
 * can return a position behind the stored one (or echo the overlapped cursor
 * when empty); never move the stored cursor backwards.
 */
export function cursorToStore(stored: string | null, server: string | null): string | null {
  if (server == null) return stored;
  const s = cursorMs(server);
  const prev = cursorMs(stored);
  if (s == null || prev == null) return server;
  // Same ms: the server's last row sorts at or after the stored one in
  // Postgres order (all rows at that ms were re-read), so take the server's.
  return s >= prev ? server : stored;
}
