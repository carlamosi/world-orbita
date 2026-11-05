# Plan de implementación: arreglos de la auditoría de World Orbita

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** que el progreso suba a Supabase y vuelva de él sin perderse ni corromperse, que FSRS gradúe las tarjetas y que los modos de juego dejen de romperse.

**Arquitectura:** el plan tiene tres fases independientes, cada una con su rama y su PR.
- **Fase 1:** arreglos de juego, solo en el cliente.
- **Fase 2:** contrato con Supabase: una migración SQL nueva, su test con PGlite y su lado cliente.
- **Fase 3:** robustez de la sincronización en el cliente.

La migración de la Fase 2 la aplica la usuaria en producción. El código de la Fase 2 funciona igual con la migración aplicada o sin aplicar.

**Stack:** React 19, TanStack Start (SSR), TypeScript, Dexie 4, ts-fsrs 5.4.1, Supabase (Postgres/plpgsql), Vitest 4, `@electric-sql/pglite` y `fake-indexeddb` (dependencias de desarrollo nuevas).

**Spec:** `docs/auditoria-world-orbita-2026-11-05.md`. Los ids de los hallazgos (FSRS-1, SQL-1, etc.) remiten a él.

## Restricciones globales

- Nunca se ejecuta `supabase link`, `db push` ni `db pull`, y nunca hay red hacia `*.supabase.co`. La base de datos real solo la toca la usuaria.
- Las migraciones solo se añaden: un archivo nuevo en `supabase/migrations/` con prefijo `20261105…`. Nunca se edita una migración existente.
- Toda función nueva o reemplazada en SQL mantiene `security invoker` (o `definer` si ya lo era) y `set search_path = public`, y usa `auth.uid()`, nunca un user_id del payload.
- Las dependencias nuevas se instalan con `npm install -D -E`, y el `package-lock.json` se commitea.
- TypeScript estricto: `npm run typecheck` debe quedar limpio en cada tarea.
- Las fechas viajan en epoch ms dentro de Dexie y de los payloads de concept_progress. Postgres usa `timestamptz`.
- Cada fase en su propia rama `fix/<fase>`. Sin push a `main` (Vercel despliega `main` a producción).
- El texto de la interfaz va en inglés, como el resto de la app, y sin "—".

## Puntos de revisión

1. **Una usuaria con 6 meses de items de country_progress en `dead`.** Tras desplegar la Fase 2 se reenvían y llegan al servidor. Lo pinea el Task 9: `dead country_progress revived once`.
2. **Responder sin conexión y que el pull llegue antes que el push.** La respuesta local no se pierde. Lo pinea el Task 13: `pull never overwrites dirty row`.
3. **Cerrar sesión a mitad de una sincronización.** Ningún dato de A acaba en la BD de B o del invitado. Lo pinea el Task 10: `cycle aborts when db swapped`.
4. **Dos dispositivos que responden la misma tarjeta.** Gana el repaso más reciente, no el contador más alto. Lo pinea el Task 7: `latest review wins across clients`.
5. **Muchas filas con el mismo `updated_at` en el límite de página.** Ninguna se pierde. Lo pinea el Task 7: `pull pages through ties`.

---

## FASE 1 · Arreglos de juego (rama `fix/gameplay`)

### Task 1: ChallengeRunner sin hooks después de un return (BUG-03)

**Archivos:** modificar `src/features/challenges/ChallengesPage.tsx` (alrededor de las líneas 395-500). Test: `src/features/challenges/ChallengeRunner.test.tsx`.

- [ ] Test: render del runner con un set de 2 items, responder los 2 y comprobar que no lanza "Rendered fewer hooks" y que `recordSessionEnd` se llama una vez con `mode: 'challenge_daily'`.
- [ ] FAIL.
- [ ] Extraer la vista final a `ChallengeEnd` (componente aparte), renderizado por el padre cuando `finished`. Todos los hooks del runner quedan antes de cualquier return.
- [ ] PASS y typecheck. Commit `fix(challenges): no hooks after early return in runner`.

### Task 2: cola emparejada item↔concepto (FSRS-3, BUG-02)

**Archivos:** modificar `src/features/engine/useSession.ts` (construcción de `queue` y `conceptQueue`, alrededor de las líneas 244-330, y la ruta de conceptRows de Review). Test: `src/features/engine/useSession.queue.test.ts`.

**Produce:** un único array interno `pairs: {item, conceptId}[]`. `queue` y `conceptQueue` se derivan de él, y no existe ningún camino que los construya por separado.

- [ ] Tests:
  - Pool de España con filas de CCAA y de provincias y nivel Provincias: toda `conceptQueue[i]` resuelve al mismo id que `queue[i]`.
  - Un concepto planificado sin item en el dataset se descarta junto con su item.
  - El pool se filtra por los ids del dataset activo, no solo por el prefijo de dominio.
- [ ] FAIL. Implementar. PASS. Commit `fix(session): build item and concept queues as pairs`.

### Task 3: token de generación en start() (BUG-04)

**Archivos:** `src/features/engine/useSession.ts`. Test en el mismo archivo de test del Task 2.

- [ ] Test: llamar a `start({subMode:'A'})` y a `start({subMode:'B'})` sin esperar; la sesión final es la de B y la nota se escribe en B.
- [ ] FAIL. Añadir `let startGen = 0` en el closure de `createSessionStore`; `start` hace `const gen = ++startGen` y vuelve sin hacer `set` si `gen !== startGen` después de cada `await`. PASS. Commit `fix(session): ignore stale concurrent start`.

### Task 4: la práctica rápida no se vacía (FSRS-2)

**Archivos:** `src/features/engine/useSession.ts` y `src/lib/fsrs/planner.ts`. La UI del estado vacío va en el componente de sesión común (`SessionEnd.tsx` o uno nuevo, `SessionEmpty.tsx`).

**Decisión:** después del planner (vencidas y aprendizaje), se rellena hasta `sessionSize` con entidades del dataset activo que aún no tienen fila (respetando continente y submodo), con un límite de `MAX_NEW_PER_DAY = 10` por día local. El día se calcula con `Intl` en la zona del dispositivo y el contador vive en `sync_meta` o en un store local por usuario. Si aun así la cola queda vacía, se muestra "All caught up" con la barra de herramientas visible y un botón "Practice anyway", que construye una cola de repaso adelantado con las tarjetas vistas de menor retrievability.

- [ ] Tests:
  - 10 filas en Learning con due en +10 min: la cola tiene nuevas hasta el tamaño de sesión.
  - Con el límite diario agotado y nada vencido, la cola queda vacía y el estado es `empty` (no `null` ni pantalla en blanco).
  - "Practice anyway" devuelve solo tarjetas ya vistas.
- [ ] FAIL. Implementar. PASS. Commit `fix(session): fill with new cards under a daily cap, empty state`.

### Task 5: Review capToCountry con etiquetas correctas (FSRS-4)

**Archivos:** `src/features/review/ReviewPage.tsx` (alrededor de la línea 194). Test: `ReviewPage.test.tsx`.

- [ ] Test: en una pregunta capToCountry, el enunciado es la capital y las opciones son nombres de país (también en el equivalente de España).
- [ ] FAIL. Implementar. PASS. Commit `fix(review): country names as options in capToCountry`.

---

## FASE 2 · Contrato Supabase (rama `fix/sync-contract`)

### Task 6: harness de PGlite para las migraciones

**Archivos:** crear `src/test/pglite.ts` y `supabase/__tests__/harness.test.ts`. Instalar `@electric-sql/pglite` con `-D -E`.

**Produce:** `createTestDb(): Promise<{db, asUser(uid), call(fn, args)}>`.
- Crea los stubs que da Supabase: schema `auth` con la tabla `auth.users(id uuid primary key)` y la función `auth.uid()`, que lee `current_setting('request.jwt.claim.sub', true)::uuid`, más los roles `anon`, `authenticated` y `service_role`.
- Aplica todos los archivos de `supabase/migrations/` en orden alfabético.
- `asUser(uid)` hace `set role authenticated` y fija la claim.

- [ ] Test: el harness aplica las 10 migraciones existentes sin error y `call('sync_pull', {_cursors:'{}'})` como usuario devuelve un objeto con las 8 entidades.
- [ ] Si alguna migración usa algo que PGlite no soporta, la stub mínima se documenta en el harness. **Si no se puede aplicar después de 2 intentos, se para con NEEDS_CONTEXT:** el controller decide si se cae a revisión estática del SQL.
- [ ] Commit `test(sql): pglite harness applying supabase migrations`.

### Task 7: migración `20261105120000_fix_sync_contract.sql`

**Archivos:** crear la migración y `supabase/__tests__/sync_contract.test.ts`.

**Contenido de la migración** (reemplaza `sync_push` y `sync_pull` completos, partiendo de su estado actual: `sync_push` de `20260906162149` y `sync_pull` de `20260809234100:308`):
1. Función `public.orbita_ts(v jsonb) returns timestamptz immutable`: si `jsonb_typeof(v) = 'number'` devuelve `to_timestamp(v::numeric/1000)`; si es string ISO, `v::text::timestamptz`; si es null, `null`. Se usa en **todas** las fechas del payload de `sync_push` (corrige SQL-1).
2. El cast de `op_id` va dentro del `begin … exception` de cada item. Un op_id inválido se rechaza con reason `invalid_op_id` y no aborta el lote (SQL-2).
3. `alter table concept_progress add column if not exists fsrs_learning_steps int not null default 0`. `sync_push` la escribe y `sync_pull` la devuelve (FSRS-1).
4. Conflicto en concept_progress (SQL-6): se acepta el entrante si `orbita_ts(fsrs_last_review) > cur.fsrs_last_review`, o si son iguales y `inc_ver > cur_ver`. La versión la asigna el servidor (`version = cur_ver + 1`). Al rechazar, sigue devolviendo canonical como hoy.
5. Cursor compuesto en `sync_pull` (SQL-3) para cada entidad, con el formato `"<iso timestamptz>|<pk>"`, donde pk es concept_id, country_code, op_id o date_key según la tabla. Condición: `(updated_at, pk) > (cur_ts, cur_pk)` con `order by updated_at, pk`. Un cursor antiguo sin `|` se interpreta como `(ts, '')`. Índices `(user_id, updated_at, pk)`.
6. Rechazar `fsrs_due` o `fsrs_last_review` ausentes en lugar de convertirlos en 1970 (SQL-14), con reason `invalid_payload`.

- [ ] Tests (contra PGlite, como dos usuarios A y B):
  - `country_progress accepts ISO and ms last_seen_at`
  - `invalid op_id rejects only that item`
  - `latest review wins across clients`: versión local 5 con review más antigua frente a versión 2 con review más nueva.
  - `pull pages through ties`: 7 filas con el mismo updated_at y limit 3; tres pulls devuelven las 7 sin repetir.
  - `legacy cursor still works`
  - `learning_steps round trip`
  - `user B never sees A rows`
- [ ] FAIL (con las migraciones actuales). Escribir la migración. PASS. Commit `fix(sql): sync contract (timestamps, op_id, learning steps, conflicts, cursor)`.

### Task 8: cliente para el contrato nuevo (FSRS-1 en el cliente)

**Archivos:** `src/lib/fsrs/adapter.ts` (rowToCard y cardToRowUpdates), `src/lib/db/orbita-db.ts` (campo opcional `fsrs_learning_steps` en `ConceptProgressRow`, sin bumpear la versión porque no lleva índice), los payloads de concept_progress en `progressRepo.ts` y `repo.ts`, la normalización del pull en `src/lib/sync/workers.ts` y los cursores en workers.

**Decisiones:**
- Una fila antigua en Learning o Relearning sin el campo deduce `learning_steps = (due - last_review) >= 10*60e3 ? 1 : 0`.
- El cliente guarda el cursor tal como lo devuelve el servidor (string opaco) y lo reenvía sin parsearlo.

- [ ] Tests:
  - Ida y vuelta fila↔Card conserva `learning_steps`.
  - Una tarjeta Learning en el paso 1 con Good pasa a Review (regresión de FSRS-1, el test de `src/__audit__/FSRS-1.test.ts` movido a `src/lib/fsrs/`).
  - Una fila antigua sin el campo deduce el paso.
  - El cursor opaco se reenvía tal cual.
- [ ] FAIL. Implementar. PASS. Commit `fix(fsrs): persist learning_steps end to end`.

### Task 9: revivir los country_progress en `dead`

**Archivos:** `src/lib/sync/workers.ts` y un test.

**Decisión:** una sola vez por BD (flag `sync_meta.revived_country_progress_v1`), los items `dead` con `entity = 'country_progress'` pasan a `pending` con `attempts = 0`. Solo se activa cuando el servidor ya acepta ISO, lo que se detecta con el primer push aceptado de country_progress o con un ping. La forma simple: revivir siempre una vez, porque si el servidor aún no acepta ISO vuelven a `dead` sin daño.

- [ ] Test: `dead country_progress revived once`. Con 3 en dead se revive una vez, la segunda ejecución no hace nada, y los dead de otras entidades no se tocan.
- [ ] FAIL. Implementar. PASS. Commit `fix(sync): revive country_progress dead letters once`.

**Entrega de la Fase 2:** PR con un checklist para la usuaria: 1) revisar la migración, 2) aplicarla en Supabase (dashboard SQL o `supabase db push` hecho por ella), 3) fusionar.

---

## FASE 3 · Sync del cliente robusto (rama `fix/sync-client`)

Instalar `fake-indexeddb` con `-D -E` para los tests de esta fase.

### Task 10: ciclo atado a una sola BD (SYNC-05, DB-02)

**Archivos:** `src/lib/sync/workers.ts` y `src/lib/db/dbProvider.ts`.

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

### Task 15: conceptIds de 2 partes en pull y fusión (FSRS-5)

**Archivos:** `src/lib/db/orbita-db.ts` (sacar la tabla de renombrado de la v9 a una función exportada `normalizeConceptId`), `workers.ts` (pull) y `migrateGuestProgress.ts`.

- [ ] Tests: un pull de `FRA:capital` acaba como el id de 3 partes; si ya existe la de 3 partes, gana la de mayor `fsrs_last_review` y se encola el renombrado.
- [ ] FAIL. Implementar. PASS. Commit `fix(sync): normalize legacy two-part concept ids on pull and merge`.

---

## Cierre de cada fase

- [ ] `npm run typecheck`, `npx vitest run` y `npm run build` con la salida real.
- [ ] Revisión por tarea (subagent-driven-development) y revisión final de la rama.
- [ ] `/commit` y push de la rama `fix/<fase>`, PR, y prueba en la preview de Vercel. La preview necesita sesión en Vercel y apunta al Supabase real: en la Fase 2, probar después de aplicar la migración.
- [ ] Fuera de este plan (anotado en la spec): los minors y lows de la auditoría, el lint (24.710 problemas, casi todos autofixables) y los tests E2E de Playwright.
