# Plan de implementación: base de datos v2 desde cero (Fases 2 y 3)

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** sustituir el esquema de Supabase por un esquema base v2 limpio que incorpore todos los arreglos de la auditoría, y dejar el cliente sincronizando con él de forma robusta.

**Arquitectura:** un único archivo de migración base, `supabase/migrations/20261106000000_baseline_v2.sql`. Las 10 migraciones anteriores se mueven a `supabase/migrations_archive/` y no se vuelven a aplicar. No hay compatibilidad con datos viejos: la usuaria confirmó que solo existen cuentas suyas y de prueba, y que se empieza de cero.

- Las fechas viajan como **epoch ms numéricos** en todos los payloads. En Postgres se guardan como `timestamptz`.
- El cliente borra una vez sus BDs locales antiguas mediante una "época de esquema".
- El reseteo de producción lo ejecuta la usuaria siguiendo un runbook.

**Stack:** Postgres/plpgsql (Supabase), `@electric-sql/pglite` (tests), React 19 + TanStack Start, Dexie 4, ts-fsrs 5.4.1, Vitest 4, `fake-indexeddb` (Fase 3).

**Spec:** `docs/auditoria-world-orbita-2026-11-05.md`. Decisión de la usuaria (2026-11-06): borrar la BD y las cuentas existentes, empezar de cero y quedarse con el esquema más nuevo.

## Restricciones globales

- Nunca se ejecuta `supabase link`, `db push`, `db reset` ni `db pull`, y nunca hay red hacia `*.supabase.co`. El reseteo y la aplicación del esquema los hace la usuaria.
- Todas las funciones SQL llevan `set search_path = public` y usan `auth.uid()`, nunca un id del payload. RLS está activa en todas las tablas, con políticas `auth.uid() = user_id`.
- Las funciones SECURITY DEFINER revocan EXECUTE a `public` y `anon`.
- Las dependencias nuevas se instalan con `npm install -D -E`.
- `npm run typecheck` limpio en cada tarea. Los tests de SQL se ejecutan contra PGlite.
- El contrato de fechas es epoch ms numérico en los payloads; el SQL rechaza con `invalid_payload` lo que no sea número.
- Git solo en comandos simples `git -C "<ruta>" <cmd>`.
- El texto de la interfaz va en inglés y sin "—".

## Puntos de revisión

1. **Dos dispositivos que responden la misma tarjeta.** Gana el repaso más reciente. Test `latest review wins across clients` (T7).
2. **Muchas filas con el mismo `updated_at`.** El pull no pierde ninguna. Test `pull pages through ties` (T7).
3. **Un op_id inválido.** Solo se rechaza ese item y el lote sigue. Test `invalid op_id rejects only that item` (T7).
4. **El usuario B.** Nunca ve ni toca filas de A, ni siquiera llamando a las RPC con ids de A. Test `user B never sees A rows` (T7).
5. **Cliente con datos locales de la BD vieja.** Arranca limpio una sola vez y no reenvía basura. Test `epoch reset wipes old dbs once` (T9).

---

## FASE 2 · Esquema v2 (rama `fix/supabase-v2`)

### Task 6: harness de PGlite

**Archivos:** crear `src/test/pglite.ts` y `supabase/__tests__/harness.test.ts`. Instalar `@electric-sql/pglite` con `-D -E`.

**Produce:** `createTestDb(files?: string[]): Promise<{db, asUser(uid: string), asAnon(), call<T>(fn, args): Promise<T>}>`.
- Aplica stubs de Supabase: schema `auth`, `auth.users(id uuid pk, email text)`, `auth.uid()` que lee `current_setting('request.jwt.claim.sub', true)::uuid`, y los roles `anon`, `authenticated` y `service_role`.
- Después aplica los archivos SQL indicados. Por defecto, todos los de `supabase/migrations/` en orden.
- `asUser(uid)` inserta el usuario en `auth.users` si no existe, ejecuta `set role authenticated` y fija la claim.

- [ ] Test: el harness aplica las migraciones ACTUALES (las 10) sin error, y `sync_pull` como usuario devuelve un objeto. Esto valida el harness antes de escribir la base nueva.
- [ ] Si PGlite no soporta algo, se documenta la stub mínima. **Si tras 2 intentos no se puede, se para con NEEDS_CONTEXT.**
- [ ] Commit `test(sql): pglite harness for supabase migrations`.

### Task 7: esquema base v2

**Archivos:**
- `git mv` de las 10 migraciones a `supabase/migrations_archive/`
- Crear `supabase/migrations/20261106000000_baseline_v2.sql`
- Crear `supabase/__tests__/baseline_v2.test.ts`

**Contenido.** Parte del estado final efectivo actual: tablas, RLS, triggers `handle_new_user`, `has_role`, `user_roles`, grants. Además, cada punto siguiente indica el hallazgo que corrige:

1. **Tablas:** profiles, user_roles, country_progress, sessions_log, challenge_attempts, unlocks, daily_streak, concept_progress, question_history, daily_summary, hardcore_exam_progress.
   - concept_progress añade `fsrs_learning_steps int not null default 0`, `fsrs_elapsed_days`, `fsrs_scheduled_days` (FSRS-1, SQL-8).
   - hardcore_exam_progress pasa a PK `(user_id, id)` con `user_id not null` (SQL-13).
2. **Helper** `public.orbita_ms(v jsonb) returns timestamptz`: un número se convierte con `to_timestamp(v::numeric/1000)`; cualquier otra cosa lanza una excepción que el bloque del item traduce a `invalid_payload`. Se usa en todas las fechas (SQL-1, SQL-14).
3. **`sync_push(_mutations jsonb)`:**
   - Cada item va en su propio `begin … exception`, incluido el cast de `op_id` a uuid (SQL-2).
   - Las entidades desconocidas se rechazan con `unknown_entity` (SQL-10, que incluye restaurar la rama profiles).
   - **concept_progress:** gana `fsrs_last_review` mayor. En empate gana el que ya está, y la `version` la asigna el servidor (`cur+1`). Se hace `select … for update` antes de comparar (SQL-6, SQL-5). Si se rechaza, se devuelve el canonical en ms.
   - **country_progress:** fusión por skill quedándose con el máximo, con `for update`.
   - **daily_summary:** idempotente. El cliente envía totales del día y el servidor guarda `greatest` (SQL-9).
   - **challenge_attempts:** `on conflict do nothing` sobre la clave natural y sobre `op_id` (SQL-12).
4. **`sync_pull(_cursors jsonb, _limit int)`:**
   - Cursor compuesto opaco `"<epoch_ms>|<pk>"` por entidad, con orden `(updated_at, pk)`.
   - Incluye `question_history` (SQL-7) y los campos FSRS nuevos.
   - Índices `(user_id, updated_at, pk)` en cada tabla (SQL-3, SQL-4).
   - Todas las fechas se devuelven en ms.
5. **`delete_account()`:** SECURITY DEFINER. Borra en una transacción los datos de `auth.uid()` y la fila de `auth.users` (`delete from auth.users where id = auth.uid()`), con `revoke execute … from public, anon` (SQL-11).

- [ ] Tests (como dos usuarios A y B):
  - `latest review wins across clients`
  - `pull pages through ties` (7 filas con el mismo updated_at y limit 3)
  - `invalid op_id rejects only that item`
  - `non-numeric date rejected as invalid_payload`
  - `user B never sees A rows`
  - `learning_steps and question_history round trip`
  - `daily_summary push is idempotent`
  - `delete_account removes only caller`
  - `anon cannot call sync_push`
- [ ] FAIL (con el harness apuntando al baseline vacío o a las migraciones archivadas, según corresponda). Escribir el baseline. PASS. Commit `feat(sql): clean baseline v2 schema with audited sync contract`.

### Task 8: cliente con el contrato v2

**Archivos:** `src/lib/fsrs/adapter.ts`, `src/lib/db/orbita-db.ts` (campos opcionales `fsrs_learning_steps`, `fsrs_elapsed_days` y `fsrs_scheduled_days`, sin índices nuevos), `src/lib/db/repo.ts`, `src/lib/db/dbProvider.ts`, `src/lib/db/progressRepo.ts`, `src/lib/sync/workers.ts`, `src/lib/sync/types.ts` y `src/lib/sync/sync.functions.ts`.

**Cambios:**
- Todas las fechas de los payloads van en ms numéricos (`last_seen_at` incluido).
- `learning_steps` hace el viaje completo fila↔Card↔payload↔pull.
- El cursor es un string opaco que se guarda y se reenvía tal cual.
- El pull de `question_history` se escribe en Dexie (put idempotente por op_id).
- `sync.functions.ts` valida `op_id` con `z.string().uuid()`: un op_id inválido se marca como dead localmente sin llamar a la RPC.

- [ ] Tests:
  - Ida y vuelta de `learning_steps`.
  - Una tarjeta Learning en el paso 1 con Good se gradúa (mover `src/__audit__/FSRS-1.test.ts` a `src/lib/fsrs/`).
  - Un payload de country_progress lleva `last_seen_at` numérico.
  - El cursor se reenvía sin parsear.
  - El pull de question_history escribe filas.
  - Un op_id inválido no llama a la RPC.
- [ ] FAIL. Implementar. PASS. Commit `feat(sync): client speaks the v2 contract`.

### Task 9: reseteo local y runbook de producción

**Archivos:**
- Crear `src/lib/db/schemaEpoch.ts`, llamado al arrancar en `src/routes/__root.tsx` antes de abrir cualquier BD
- Crear `supabase/reset/2026-11-06-reset.sql`
- Crear `docs/runbooks/supabase-v2-reset.md`

**Decisiones:**
- `SCHEMA_EPOCH = 2` en localStorage (`orbita_schema_epoch`). Si el valor es menor o no existe, se borran todas las BDs IndexedDB cuyo nombre empiece por `orbita` (`indexedDB.databases()` con fallback a la lista conocida) y las claves de localStorage con prefijo `orbita`, se guarda el epoch y se sigue.
- Todo va con try/catch. Si falla, se registra el error y no se bloquea la app.
- `reset.sql` (lo ejecuta la usuaria en el SQL editor de Supabase):
  1. `delete from auth.users;`
  2. `drop` de todas las funciones y tablas de `public` creadas por las migraciones archivadas.
  3. `delete from supabase_migrations.schema_migrations;`
- Después se aplica el baseline con `supabase db push` y se inserta su versión en `schema_migrations`. El runbook explica los dos caminos (SQL editor o CLI) paso a paso, cómo verificar con 3 consultas, y cómo crear una cuenta nueva y comprobar que se sincroniza.

- [ ] Tests:
  - `epoch reset wipes old dbs once`: con fake-indexeddb, dos BDs `orbita-*` y epoch ausente se borran; la segunda llamada no hace nada.
  - Un error al borrar no lanza.
  - `reset.sql` más el baseline aplicados en PGlite (con datos de las migraciones archivadas) dejan el esquema v2 operativo.
- [ ] Commit `feat(db): one-time local reset and supabase v2 reset runbook`.

**Entrega de la Fase 2:** un PR con el runbook enlazado. Orden de despliegue que debe seguir la usuaria:
1. Fusionar el PR, lo que despliega el cliente v2.
2. Ejecutar `reset.sql`.
3. Aplicar el baseline.
4. Crear su cuenta nueva.

Entre los pasos 1 y 3 la sincronización falla de forma controlada (el cliente reintenta con backoff y no pierde nada local).

---

## FASE 3 · Robustez del cliente de sync (rama `fix/sync-client`)

Se mantienen las tareas 10 a 14 del plan anterior (`docs/superpowers/plans/2026-11-05-world-orbita-fixes.md`), con dos cambios:
- **Se elimina** el antiguo Task 9 (revivir items dead), porque la base es nueva.
- **Se elimina** el antiguo Task 15 (ids de 2 partes), porque los datos locales se borran con el epoch.
- **Task 10:** cada ciclo trabaja sobre una única BD y el swap espera a los ciclos en curso (SYNC-05, DB-02).
- **Task 11:** recuperación de in_flight por BD, con lease (SYNC-01).
- **Task 12:** los errores transitorios no van a dead, y se añade "Retry failed" (SYNC-04).
- **Task 13:** el pull no pisa filas dirty ni con ops pendientes; en concept_progress gana la review más reciente (SYNC-03, SYNC-06, SYNC-11).
- **Task 14:** la fusión de invitado es transaccional y encola ops (SYNC-08, DB-03).
