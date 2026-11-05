import { z } from "zod";

/** op_id must be a UUID: sync_push rejects anything else as invalid_op_id. */
export const OpIdSchema = z.string().uuid();

export function isValidOpId(v: unknown): v is string {
  return OpIdSchema.safeParse(v).success;
}
