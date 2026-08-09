import { c as createServerRpc } from './createServerRpc-B3iuurtM.mjs';
import { a as createServerFn } from './index.mjs';
import { r as requireSupabaseAuth } from './auth-middleware-C5JPW8h7.mjs';
import '../_libs/seroval.mjs';
import '../_libs/react.mjs';
import { o as objectType, r as recordType, s as stringType, u as unknownType, e as enumType, a as arrayType, n as numberType } from '../_libs/zod.mjs';
import 'node:async_hooks';
import '../_libs/h3-v2.mjs';
import '../_libs/rou3.mjs';
import '../_libs/srvx.mjs';
import 'node:stream';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import '../_libs/tanstack__react-router.mjs';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';

const MutationSchema = objectType({
  op_id: stringType().uuid(),
  entity: enumType(["sessions_log", "country_progress", "concept_progress", "question_history", "daily_summary", "challenge_attempts", "unlocks", "daily_streak", "profiles"]),
  op: enumType(["insert", "upsert"]),
  payload: recordType(stringType(), unknownType())
});
const PushSchema = objectType({
  mutations: arrayType(MutationSchema).max(100)
});
const _syncPush_createServerFn_handler = createServerRpc({
  id: "53c64cca3646c2b4aaf504a141a3d2042fd2449c1c0271acd3f45828b2e21f01",
  name: "_syncPush",
  filename: "src/lib/sync/sync.functions.ts"
}, (opts) => _syncPush.__executeServer(opts));
const _syncPush = createServerFn({
  method: "POST"
}).middleware([requireSupabaseAuth]).inputValidator((d) => PushSchema.parse(d)).handler(_syncPush_createServerFn_handler, async ({
  data,
  context
}) => {
  const {
    supabase
  } = context;
  const {
    data: out,
    error
  } = await supabase.rpc("sync_push", {
    _mutations: data.mutations
  });
  if (error) throw new Error(error.message);
  return JSON.stringify(out ?? {});
});
const PullSchema = objectType({
  cursors: recordType(stringType(), stringType().nullable()).default({}),
  limit: numberType().int().min(1).max(1e3).optional()
});
const _syncPull_createServerFn_handler = createServerRpc({
  id: "a47e3e26109e8d69cb5b2ed73ab22d2a9aaa221b5b9490a11286d7e99f779006",
  name: "_syncPull",
  filename: "src/lib/sync/sync.functions.ts"
}, (opts) => _syncPull.__executeServer(opts));
const _syncPull = createServerFn({
  method: "POST"
}).middleware([requireSupabaseAuth]).inputValidator((d) => PullSchema.parse(d)).handler(_syncPull_createServerFn_handler, async ({
  data,
  context
}) => {
  const {
    supabase
  } = context;
  const {
    data: out,
    error
  } = await supabase.rpc("sync_pull", {
    _cursors: data.cursors,
    _limit: data.limit ?? 500
  });
  if (error) throw new Error(error.message);
  return JSON.stringify(out ?? {});
});

export { _syncPull_createServerFn_handler, _syncPush_createServerFn_handler };
