export type SyncEntity =
  | "sessions_log"
  | "country_progress"
  | "concept_progress"
  | "question_history"
  | "daily_summary"
  | "challenge_attempts"
  | "unlocks"
  | "daily_streak"
  | "profiles";

export interface Mutation {
  op_id: string;
  entity: SyncEntity;
  op: "insert" | "upsert";
  payload: Record<string, unknown>;
}

/**
 * sync_push rejection reasons (v2). The first three are permanent: the outbox
 * row goes dead at once. stale_review comes with a canonical row to apply.
 * Any other string is an unexpected server error and is retried.
 */
export type PermanentRejectReason = "invalid_payload" | "invalid_op_id" | "unknown_entity";
export type RejectReason = PermanentRejectReason | "stale_review" | (string & {});

export const PERMANENT_REJECT_REASONS: readonly string[] = [
  "invalid_payload",
  "invalid_op_id",
  "unknown_entity",
];

export interface PushResult {
  accepted: string[];
  /** op_id is the raw string sent, or null when the item was not an object. */
  rejected: { op_id: string | null; reason: RejectReason }[];
  canonical: { entity: SyncEntity; op_id: string; payload: Record<string, unknown> }[];
}

export interface PullEntityResult {
  rows: Record<string, unknown>[];
  /** Opaque "<epoch_ms>|<pk>" cursor: store and resend as-is. */
  cursor: string | null;
  /** True when more rows remain: pull again in the same cycle. */
  has_more: boolean;
}

export type PullResult = Partial<Record<SyncEntity, PullEntityResult>>;
