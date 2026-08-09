import { D as Dexie } from '../_libs/dexie.mjs';
import { c as createOrbitaDb } from './orbita-db-Bdp3ClIj.mjs';
import { a as authDebug } from './router-T2jDQtma.mjs';
import '../_libs/react.mjs';
import '../_libs/sonner.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
import '../_libs/tanstack__react-router.mjs';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import 'node:stream';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import '../_libs/clsx.mjs';
import '../_libs/tailwind-merge.mjs';
import './client-CnjuyyaV.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
import '../_libs/radix-ui__react-dropdown-menu.mjs';
import '../_libs/radix-ui__primitive.mjs';
import '../_libs/radix-ui__react-compose-refs.mjs';
import '../_libs/radix-ui__react-context.mjs';
import '../_libs/@radix-ui/react-use-controllable-state+[...].mjs';
import '../_libs/@radix-ui/react-use-layout-effect+[...].mjs';
import '../_libs/radix-ui__react-primitive.mjs';
import '../_libs/radix-ui__react-slot.mjs';
import '../_libs/radix-ui__react-menu.mjs';
import '../_libs/radix-ui__react-collection.mjs';
import '../_libs/radix-ui__react-direction.mjs';
import '../_libs/@radix-ui/react-dismissable-layer+[...].mjs';
import '../_libs/@radix-ui/react-use-callback-ref+[...].mjs';
import '../_libs/@radix-ui/react-use-escape-keydown+[...].mjs';
import '../_libs/radix-ui__react-focus-guards.mjs';
import '../_libs/radix-ui__react-focus-scope.mjs';
import '../_libs/radix-ui__react-popper.mjs';
import '../_libs/floating-ui__react-dom.mjs';
import '../_libs/floating-ui__dom.mjs';
import '../_libs/floating-ui__core.mjs';
import '../_libs/floating-ui__utils.mjs';
import '../_libs/radix-ui__react-arrow.mjs';
import '../_libs/radix-ui__react-use-size.mjs';
import '../_libs/radix-ui__react-portal.mjs';
import '../_libs/radix-ui__react-presence.mjs';
import '../_libs/radix-ui__react-roving-focus.mjs';
import '../_libs/radix-ui__react-id.mjs';
import '../_libs/aria-hidden.mjs';
import '../_libs/react-remove-scroll.mjs';
import '../_libs/react-remove-scroll-bar.mjs';
import '../_libs/react-style-singleton.mjs';
import '../_libs/get-nonce.mjs';
import '../_libs/use-sidecar.mjs';
import '../_libs/use-callback-ref.mjs';
import '../_libs/framer-motion.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';
import '../_libs/lucide-react.mjs';
import '../_libs/zustand.mjs';

const GUEST_DB_NAME = "orbita-local";
async function migrateGuestProgress(userDb, userId) {
  const guestDbExists = await Dexie.exists(GUEST_DB_NAME);
  if (!guestDbExists) {
    authDebug("migrate:no_guest_db", { userId });
    return { migrated: 0, skipped: 0 };
  }
  const guestDb = createOrbitaDb(GUEST_DB_NAME);
  let migrated = 0;
  let skipped = 0;
  try {
    authDebug("migrate:start", { userId });
    const guestConcepts = await guestDb.concept_progress.toArray();
    if (guestConcepts.length > 0) {
      const existing = await userDb.concept_progress.where("conceptId").anyOf(guestConcepts.map((c) => c.conceptId)).toArray();
      const existingMap = new Map(existing.map((c) => [c.conceptId, c]));
      const toUpsert = guestConcepts.map((guest) => {
        const ex = existingMap.get(guest.conceptId);
        if (!ex || guest.fsrs_reps > ex.fsrs_reps) {
          return { ...guest, user_id: userId, dirty: 1 };
        }
        skipped++;
        return null;
      }).filter(Boolean);
      if (toUpsert.length > 0) {
        await userDb.concept_progress.bulkPut(toUpsert);
        migrated += toUpsert.length;
      }
      authDebug("migrate:concept_progress", { upserted: toUpsert.length, skipped, userId });
    }
    const guestHistory = await guestDb.question_history.toArray();
    if (guestHistory.length > 0) {
      await userDb.question_history.bulkPut(guestHistory).catch(() => {
      });
      migrated += guestHistory.length;
      authDebug("migrate:question_history", { count: guestHistory.length, userId });
    }
    const guestSessions = await guestDb.gameSessions.toArray();
    if (guestSessions.length > 0) {
      const rows = guestSessions.map(({ id: _id, ...rest }) => ({
        ...rest,
        op_id: rest.op_id ?? crypto.randomUUID(),
        dirty: 1
      }));
      await userDb.gameSessions.bulkPut(rows).catch(() => {
      });
      migrated += rows.length;
      authDebug("migrate:game_sessions", { count: rows.length, userId });
    }
    const guestCP = await guestDb.countryProgress.toArray();
    if (guestCP.length > 0) {
      const exCP = await userDb.countryProgress.where("iso3").anyOf(guestCP.map((c) => c.iso3)).toArray();
      const exMap = new Map(exCP.map((c) => [c.iso3, c]));
      const rows = guestCP.map((guest) => {
        const ex = exMap.get(guest.iso3);
        if (!ex) return { ...guest, dirty: 1 };
        const mergedSkills = { ...ex.skills };
        for (const [skill, stat] of Object.entries(guest.skills)) {
          const exStat = ex.skills[skill];
          if (!exStat || stat && stat.confidence > exStat.confidence) {
            mergedSkills[skill] = stat;
          }
        }
        return {
          ...ex,
          skills: mergedSkills,
          lastSeenAt: Math.max(ex.lastSeenAt, guest.lastSeenAt),
          dirty: 1
        };
      });
      await userDb.countryProgress.bulkPut(rows).catch(() => {
      });
      authDebug("migrate:country_progress", { count: rows.length, userId });
    }
    const guestUnlocks = await guestDb.unlocks.toArray();
    if (guestUnlocks.length > 0) {
      const exUnlocks = await userDb.unlocks.where("key").anyOf(guestUnlocks.map((u) => u.key)).toArray();
      const exUnlockMap = new Map(exUnlocks.map((u) => [u.key, u]));
      const toUpsert = guestUnlocks.filter((g) => {
        const ex = exUnlockMap.get(g.key);
        return !ex || g.progress > ex.progress;
      });
      if (toUpsert.length > 0) {
        await userDb.unlocks.bulkPut(toUpsert).catch(() => {
        });
        authDebug("migrate:unlocks", { count: toUpsert.length, userId });
      }
    }
    await guestDb.close();
    await Dexie.delete(GUEST_DB_NAME);
    authDebug("migrate:complete", { userId, migrated, skipped });
    return { migrated, skipped };
  } catch (err) {
    authDebug("migrate:error", { userId, error: err instanceof Error ? err.message : String(err) });
    return { migrated, skipped };
  } finally {
    try {
      guestDb.close();
    } catch {
    }
  }
}

export { migrateGuestProgress };
