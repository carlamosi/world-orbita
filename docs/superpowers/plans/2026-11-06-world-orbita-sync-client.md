# Plan de implementación: Fase 3, robustez del cliente de sync

> **Para agentes:** SUB-SKILL OBLIGATORIA: superpowers:subagent-driven-development. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** que el cliente de sync no pierda, duplique ni mezcle datos entre BDs, y que los errores transitorios no cierren sesión ni manden items a dead.

**Rama:** `fix/sync-client` desde `main` bfdcdb5 (Fases 1 y 2 ya en producción).

**Spec:** `docs/auditoria-world-orbita-2026-11-05.md` (ids SYNC-*, DB-*). Las tareas 10 a 14 se copian tal cual de `docs/superpowers/plans/2026-11-05-world-orbita-fixes.md` (FASE 3), con los cambios de `docs/superpowers/plans/2026-11-06-world-orbita-supabase-v2.md` (FASE 3): se eliminan los antiguos Task 9 y Task 15. Se añade el Task 16, que sale del Ruling 10 de la Fase 2 y va primero.

**Orden de ejecución:** 16, 10, 11, 12, 13, 14.

## Restricciones globales

- Nunca se ejecuta `supabase link`, `db push` ni `db pull`, y nunca hay red hacia `*.supabase.co`. Los tests de SQL usan PGlite (`src/test/pglite.ts`, `{supabaseDefaultGrants:false}`).
- Esta fase no añade migraciones SQL.
- Las dependencias nuevas se instalan con `npm install -D -E`, y el `package-lock.json` se commitea.
- TypeScript estricto: `npm run typecheck` debe quedar limpio en cada tarea.
- Tests: `npx vitest run --exclude "src/__audit__/**"`. No se commitea `src/__audit__/` ni `src/routeTree.gen.ts` (cambio solo de CRLF) ni `HANDOFF.md`.
- Las fechas viajan en epoch ms dentro de Dexie y de los payloads de concept_progress.
- Sin push a `main` (Vercel despliega `main` a producción). Sin push de la rama sin el OK de la usuaria.
- El texto de la interfaz va en inglés y sin "—".
- Git solo con comandos simples `git -C "C:/Users/carla/Desktop/Projects/world-orbita" <cmd>`, uno por llamada.

## Estado heredado de la Fase 2 (no rehacer)

- `workers.ts` ya trata el 401 del middleware sin gastar attempts (`handleAuthRejection` → `verifySessionOrSignOut`) y el rechazo FK por item (`handleOrphanedSession`).
- Los reasons permanentes (`invalid_payload`, `invalid_op_id`, `unknown_entity`) ya van a dead al momento; `stale_review` aplica el canonical.
- `apply.ts` ya tiene `shouldApplyPulledConcept` (gana la review más reciente; no pisa una local más nueva con dirty) y lo usa también el canonical.
- Lo que queda abierto está en los minors aplazados del ledger de la Fase 2 (`.superpowers/sdd/2026-11-06-world-orbita-supabase-v2/progress.md`).

---

### Task 16: no cerrar sesión ante errores transitorios de getUser (Ruling 10 de la Fase 2)

**Archivos:** `src/lib/sync/workers.ts` (`verifySessionOrSignOut`, ~línea 109) y `src/lib/sync/workers.test.ts` (describe "auth rejection by the middleware (deleted user)", ~línea 433).

**Bug:** tras un 401 del middleware, `verifySessionOrSignOut` hace `gone = !!error || !data?.user` y en el `catch` pone `gone = true`. Un usuario legítimo con red intermitente queda desconectado si `getUser()` falla por red, 5xx o 429.

**Decisiones:**
- `gone` es verdadero SOLO si:
  - `error.name === "AuthSessionMissingError"` (en auth-js 2.108.2 su status es 400, así que se reconoce por el name), o
  - `error.status` es 401, 403 o 404, o
  - no hay `error` y tampoco `data.user`.
- Cualquier otro error (`AuthRetryableFetchError`, 5xx, 429, status ausente) o una excepción lanzada por `getUser()` se trata como desconocido: no se cierra sesión. Las filas ya quedaron `pending` con backoff en `handleAuthRejection`, así que se reintenta en el siguiente ciclo.
- Se clasifica por `name` y `status`, no con `instanceof` ni `isAuthError` de auth-js, porque los tests simulan errores como objetos planos.
- Se actualiza el comentario de `handleAuthRejection` para que diga lo mismo.
- No se cambia `handleOrphanedSession` ni el flujo del 401.

- [ ] Tests nuevos en el describe existente, todos con `authFail()` y una fila en el outbox; en cada uno, la fila queda `pending` con `attempts === 0`:
  - NO cierra sesión cuando `getUser` devuelve `{ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 503 } }`.
  - NO cierra sesión con `{ data: { user: null }, error: { name: "AuthApiError", status: 429 } }`.
  - NO cierra sesión cuando `getUser` lanza (`throw new TypeError("Failed to fetch")`).
  - SÍ cierra sesión con `{ data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } }`.
  - SÍ cierra sesión con status 401 y con status 404.
  - SÍ cierra sesión con `{ data: { user: null }, error: null }`.
  - Los tests existentes (403 → cierra; user presente → no cierra; pull con 403 → cierra) siguen pasando.
- [ ] FAIL (los tres "NO cierra" deben fallar con el código actual). Implementar. PASS. Commit `fix(sync): only sign out on definitive getUser answers`.

### Task 10: ciclo atado a una sola BD (SYNC-05, DB-02)

**Archivos:** `src/lib/sync/workers.ts` y `src/lib/db/dbProvider.ts`.

Instalar `fake-indexeddb` con `-D -E` para los tests de esta fase.

**Decisiones:**
- Cada `runPushOnce` y `runPullOnce` captura `const d = db(); const name = currentDbName()` al empezar, usa solo `d` y, tras cada `await`, aborta si `currentDbName() !== name`.
- Las filas del outbox se borran y actualizan por `op_id`, nunca por `id`.
- `swap()` espera a que terminen los ciclos en curso (una promesa compartida `inflightCycle`) antes de cambiar de BD.
- `setSignedIn(true)` solo después de que `swap(uid)` termine.

- [ ] Tests (fake-indexeddb): `cycle aborts when db swapped` (un swap a mitad de un push no escribe en la BD nueva ni toca su outbox) y `outbox rows addressed by op_id`.
- [ ] FAIL. Implementar. PASS. Commit `fix(sync): bind each cycle to one db, wait on swap`.

### Task 11: recuperación de in_flight por BD (SYNC-01)

**Archivos:** `src/lib/sync/workers.ts`.

**Decisión:** `recoverInFlight` y `purgeBrokenOpIds` se ejecutan en `onSwap`, para cada BD que se activa, y al arrancar después de que el swap inicial termine. Además, un item en `in_flight` con `next_attempt_at < now - 60s` se trata como `pending` (lease).

- [ ] Tests: con in_flight en `orbita-<uid>`, el arranque más el swap lo recuperan; un lease caducado se vuelve a enviar.
- [ ] FAIL. Implementar. PASS. Commit `fix(sync): recover in-flight per db with a lease`.

### Task 12: errores transitorios sin dead (SYNC-04)

**Archivos:** `src/lib/sync/workers.ts`, el SyncPill y la página de sync en `src/features/sync/*`.

**Decisiones:**
- Los errores de transporte o autenticación (fetch lanza, 401, 5xx) no incrementan `attempts`: solo aplican backoff, con un máximo de 5 minutos.
- `dead` queda solo para los `rejected` deterministas del servidor tras 10 intentos.
- El backoff se reinicia en `online` y `visibilitychange`.
- El SyncPill muestra el recuento de dead.
- "Clear dead letter" pasa a ser "Retry failed" (attempts=0, pending). Borrar exige confirmación.

- [ ] Tests: 20 fallos de red seguidos y ningún item en dead; un rechazo del servidor 10 veces acaba en dead; "Retry failed" devuelve los items a pending.
- [ ] FAIL. Implementar. PASS. Commit `fix(sync): transient errors never dead-letter, retry failed`.

### Task 13: el pull no pisa cambios locales (SYNC-03, SYNC-06)

**Archivos:** `src/lib/sync/workers.ts` (aplicación del pull y del canonical).

**Decisiones:**
- No se aplica una fila del pull ni del canonical sobre una local con `dirty = 1` ni con ops `pending` o `in_flight` para la misma clave.
- En concept_progress, si la local no está dirty, gana la de mayor `fsrs_last_review`.
- En country_progress, la fusión es por skill quedándose con la versión mayor (igual que hace el servidor).
- `SYNC-11`: el cursor solo avanza si las escrituras en Dexie terminaron sin error (sin `.catch(() => {})`).

- [ ] Tests: `pull never overwrites dirty row`; el canonical con review más antigua no pisa la local; la fusión por skill conserva los dos skills; un fallo de escritura no avanza el cursor.
- [ ] FAIL. Implementar. PASS. Commit `fix(sync): pull merges instead of overwriting local changes`.

### Task 14: fusión de invitado transaccional (SYNC-08, DB-03)

**Archivos:** `src/lib/auth/migrateGuestProgress.ts` y `dbProvider.ts` (se elimina la ruta duplicada `mergeLocalIntoUserDb` o se unifica).

**Decisiones:**
- Una sola `userDb.transaction('rw', [...tablas, outbox])` sin `.catch` internos.
- Por cada fila fusionada se encola su op. El concept_progress fusionado usa la regla "gana la review más reciente".
- `orbita-local` se borra solo después del commit. Si algo falla, se conserva y se marca `sync_meta.guest_merge_pending`.

- [ ] Tests: la fusión en una BD de usuario no vacía encola ops; un fallo a mitad no borra `orbita-local` ni deja la BD de usuario a medias; una doble llamada no duplica.
- [ ] FAIL. Implementar. PASS. Commit `fix(auth): transactional guest merge that enqueues ops`.

---

## Cierre de la fase

- [ ] `npm run typecheck`, `npx vitest run --exclude "src/__audit__/**"` y `npm run build` con la salida real.
- [ ] Revisión final de la rama (opus) con los minors aplazados de los ledgers de las Fases 2 y 3.
- [ ] Con el OK de la usuaria: push de `fix/sync-client`, PR y prueba en la preview de Vercel.
