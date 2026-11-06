# Runbook: reseteo de Supabase a la v2

Borra TODOS los usuarios y datos de producción y deja el esquema `baseline_v2`. Lo ejecuta una persona a mano; nada de esto lo hace el código.

Archivos implicados:
- `supabase/reset/2026-11-06-reset.sql` (borra todo lo de v1; se puede ejecutar dos veces)
- `supabase/migrations/20261106000000_baseline_v2.sql` (el esquema nuevo)
- `supabase/migrations_archive/` (las 10 migraciones antiguas, ya no se aplican)

## 0. Requisitos previos

1. Haz merge del PR de la v2 y despliega el cliente. El cliente v1 no habla el contrato nuevo (fechas en ms, cursores compuestos): si lo dejas vivo contra la base nueva, solo recibe errores. Entre el despliegue del cliente v2 y el reset (paso 1) hay un hueco en el que el cliente v2 habla con la base v1 y la sincronización falla; mantenlo lo más corto posible (haz el reset justo después de desplegar). Los datos de ese hueco de usuarios con cuenta se pierden igualmente: la cuenta se borra en el reset y la cuenta nueva tiene otro uid y otra base local, no porque el reset local los borre. Los datos de invitado (`orbita-local`) generados en el hueco sobreviven y se fusionan en la cuenta nueva.
2. El cliente v2 borra cada base local `orbita-*` de IndexedDB la primera vez que la abre (marca `orbita_epoch_db:<nombre>` en localStorage), y al arrancar limpia las claves `orbita*` de localStorage (`orbita_schema_epoch = 2`). No toca las claves `sb-*` de la sesión. No hace falta pedir nada a los usuarios.
3. Backup: decisión tomada, no se necesita. Si cambias de opinión, hazlo ANTES de empezar: Dashboard > Database > Backups. `supabase db dump` NO incluye el esquema `auth` (las cuentas) y necesita Docker; para las cuentas usa el backup del Dashboard. Guarda cualquier archivo fuera del repo.

## 1. Elige un camino

### Camino A: SQL editor del Dashboard (más sencillo)

1. Dashboard > SQL Editor > New query. Pega `supabase/reset/2026-11-06-reset.sql` completo y, justo debajo en la MISMA query, `supabase/migrations/20261106000000_baseline_v2.sql` completo; ejecuta (Run). Así no hay ningún momento con la base sin esquema, y todo corre como una sola transacción: si falla, no se ha borrado nada. (Si prefieres dos queries, ejecútalas seguidas y sin pausa.)
2. Nueva query, registra el baseline en el historial (así `supabase db push` no intenta reaplicarlo):

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20261106000000', 'baseline_v2')
on conflict (version) do nothing;
```

   Si da error de esquema inexistente (`supabase_migrations` no existe, p. ej. proyecto creado por Lovable), ignóralo.

### Camino B: CLI

1. Vincula el proyecto (la referencia está en el README): `npx supabase link --project-ref <ref>`.
2. Ejecuta `supabase/reset/2026-11-06-reset.sql` en el SQL editor (la CLI no tiene un comando directo para SQL arbitrario remoto). Este script ya vacía `schema_migrations`.
3. El `repair` es redundante tras el paso 2, porque el reset ya vació el historial. Solo hace falta si NO ejecutaste reset.sql (por ejemplo, si borraste los datos por otra vía) y el historial remoto aún lista las 10 versiones antiguas. En ese caso márcalas como revertidas:

```
supabase migration repair --status reverted 20260616184030 20260616184048 20260618063158 20260618063218 20260618063254 20260619161538 20260809234100 20260810000000 20260810110000 20260906162149
```

4. `supabase db push`. Aplica `20261106000000_baseline_v2.sql` y lo registra solo.
5. Comprueba con `supabase migration list` que local y remoto coinciden: una sola versión, `20261106000000`.

## 2. Verificación (3 consultas, en el SQL editor)

1. Tablas existen con RLS activada (deben salir 11 filas, todas `true`):

```sql
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```

2. Funciones y quién puede ejecutarlas (`sync_push`, `sync_pull`, `delete_account` deben tener `authenticated`; `has_role`, `handle_new_user`, `orbita_touch_updated_at` solo `service_role`):

```sql
select p.proname, p.proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;
```

3. Nada para `anon` (debe devolver 0 filas):

```sql
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'PUBLIC')
union all
select grantee, routine_name, privilege_type from information_schema.role_routine_grants
where routine_schema = 'public' and grantee in ('anon', 'PUBLIC');
```

## 3. Smoke tests (con la app en producción)

1. Crea una cuenta nueva (email de prueba) desde la app. Debe aparecer una fila en `public.profiles` (lo crea el trigger `on_auth_user_created`).
2. Juega 5 preguntas. Dashboard > Table Editor: aparecen filas en `question_history` y `concept_progress` con tu `user_id`.
3. Abre otro navegador (o ventana privada), inicia sesión con la misma cuenta: en unos segundos aparece el mismo progreso (pull).
4. Prueba de `delete_account` en Supabase real. El cliente ya no llama a `auth.admin.deleteUser`: la función SQL debe borrar `auth.users` ella sola. Usa una cuenta de prueba, no la tuya buena. En la app, Ajustes > borrar cuenta. Comprueba:

```sql
select count(*) from auth.users where email = '<email de prueba>';  -- 0
select count(*) from public.profiles where id not in (select id from auth.users);  -- 0
```

   Si falla con `permission denied for table users` (el rol dueño de la función no puede borrar de `auth.users`): ejecuta `select proowner::regrole from pg_proc where proname = 'delete_account';`. Debe ser `postgres`. Si es otro, `alter function public.delete_account() owner to postgres;`. Si aun así `postgres` no puede, como último recurso `grant delete on auth.users to postgres;`. Si nada funciona, avisa: habría que volver a llamar a `auth.admin.deleteUser` desde el servidor tras el RPC.
5. Con el borrado hecho, comprueba que la app queda en sesión cerrada y con la base local vacía.
6. Sesiones antiguas. Los navegadores que estaban con la sesión abierta antes del reset conservan un JWT (`sb-*`) de un usuario que ya no existe. El middleware de las server functions (`requireSupabaseAuth`) llama a `auth.getUser(token)`; GoTrue devuelve 403 y la función falla con `Unauthorized: Invalid token` (401) antes de llegar a `sync_push`. Comportamiento esperado del cliente: ante ese error de autenticación NO gasta reintentos (las filas siguen `pending`, con un breve aplazamiento), consulta `supabase.auth.getUser()` una sola vez y, si el usuario ya no existe (o la sesión no se puede refrescar), cierra sesión una vez, en el siguiente ciclo de push o pull (segundos). Si `getUser` responde bien (fallo transitorio) no cierra sesión y reintenta más tarde. Como respaldo, un rechazo por elemento `... violates foreign key constraint "<tabla>_user_id_fkey"` produce el mismo cierre. Verificación: abre un perfil de navegador que estuviera con sesión iniciada antes del reset, carga la app y juega unas preguntas; en pocos segundos debe quedar con la sesión cerrada, sin filas `dead` y sin bucle de errores. Si no cierra sesión (error de autenticación repetido en la consola de sync), es un bug del cliente: cierra sesión a mano y avisa.

7. Tras el reseteo, recarga las pestañas abiertas de la app para que carguen el cliente y la base local nuevos.

## 4. Rollback

- Antes de la fase 1 no hay nada que revertir.
- Después, no hay vuelta atrás sin backup: el reset borra usuarios y datos. Con un backup (sección 0.3) se restaura con `psql` sobre una base vacía, o desde el Dashboard (Backups > Restore).
- Si solo falla el baseline (error al pegarlo): el script de reset se puede volver a ejecutar sin problema; vuelve a empezar desde el paso 1.
- Si el cliente v2 tiene un bug grave: revierte el despliegue del cliente, pero la base seguirá en v2 y el cliente v1 no es compatible; arregla hacia delante.
- Los clientes ya reseteados no se vuelven a resetear (guardan `orbita_schema_epoch = 2`). Para forzar otro reseteo local, sube `SCHEMA_EPOCH` en `src/lib/db/schemaEpoch.ts`.

## 5. Después

- `SUPABASE_SERVICE_ROLE_KEY` ya no lo usa `account.functions.ts`. Comprueba si algo más usa `client.server.ts` antes de quitar la variable del entorno.
- Mantén `supabase/migrations_archive/` solo como referencia; no la muevas de vuelta a `migrations/`.
