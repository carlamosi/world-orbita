import { c as createServerRpc } from './createServerRpc-B3iuurtM.mjs';
import { a as createServerFn } from './index.mjs';
import { r as requireSupabaseAuth } from './auth-middleware-C5JPW8h7.mjs';
import '../_libs/seroval.mjs';
import '../_libs/react.mjs';
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

const deleteAccount_createServerFn_handler = createServerRpc({
  id: "605045233debcf4fbca7c93f06a21eab51d31e90e5fab3208ca6233b08e8f1d1",
  name: "deleteAccount",
  filename: "src/lib/account.functions.ts"
}, (opts) => deleteAccount.__executeServer(opts));
const deleteAccount = createServerFn({
  method: "POST"
}).middleware([requireSupabaseAuth]).handler(deleteAccount_createServerFn_handler, async ({
  context
}) => {
  const {
    error: rpcErr
  } = await context.supabase.rpc("delete_account");
  if (rpcErr) throw new Error(rpcErr.message);
  const {
    supabaseAdmin
  } = await import('./client.server-BJ8RDer3.mjs');
  const {
    error: adminErr
  } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
  if (adminErr) throw new Error(adminErr.message);
  return {
    ok: true
  };
});

export { deleteAccount_createServerFn_handler };
