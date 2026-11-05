# Runbook: reseteo de Supabase a la v2

Borra TODOS los usuarios y datos de producción y deja el esquema `baseline_v2`. Lo ejecuta una persona a mano; nada de esto lo hace el código.

Archivos implicados:
- `supabase/reset/2026-11-06-reset.sql` (borra todo lo de v1; se puede ejecutar dos veces)
- `supabase/migrations/20261106000000_baseline_v2.sql` (el esquema nuevo)
- `supabase/migrations_archive/` (las 10 migraciones antiguas, ya no se aplican)

## 0. Requisitos previos

1. Haz merge del PR de la v2 y despliega el cliente. El cliente v1 no habla el contrato nuevo (fechas en ms, cursores compuestos): si lo dejas vivo contra la base nueva, solo recibe errores.
2. El cliente v2 borra la base local (IndexedDB `orbita*` y claves `orbita*` de localStorage) una única vez al arrancar (`SCHEMA_EPOCH = 2`). No hace falta pedir nada a los usuarios.
3. Backup: decisión tomada, no se necesita. Si cambias de opinión, hazlo ANTES de empezar: Dashboard > Database > Backups, o `supabase db dump --linked -f backup-v1.sql` y `supabase db dump --linked --data-only -f backup-v1-data.sql`. Guarda los archivos fuera del repo.

## 1. Elige un camino

### Camino A: SQL editor del Dashboard (más sencillo)

1. Dashboard > SQL Editor > New query. Pega `supabase/reset/2026-11-06-reset.sql` completo y ejecuta (Run).
2. Nueva query. Pega `supabase/migrations/20261106000000_baseline_v2.sql` completo y ejecuta.
3. Nueva query, registra el baseline en el historial (así `supabase db push` no intenta reaplicarlo):

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20261106000000', 'baseline_v2')
on conflict (version) do nothing;
```

### Camino B: CLI

1. Vincula el proyecto (la referencia está en el README): `npx supabase link --project-ref <ref>`.
2. Ejecuta `supabase/reset/2026-11-06-reset.sql` en el SQL editor (la CLI no tiene un comando directo para SQL arbitrario remoto). Este script ya vacía `schema_migrations`.
3. Si el paso 2 no vació el historial, o prefieres hacerlo por CLI, marca las 10 versiones antiguas como revertidas:

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

## 4. Rollback

- Antes de la fase 1 no hay nada que revertir.
- Después, no hay vuelta atrás sin backup: el reset borra usuarios y datos. Con un backup (sección 0.3) se restaura con `psql` sobre una base vacía, o desde el Dashboard (Backups > Restore).
- Si solo falla el baseline (error al pegarlo): el script de reset se puede volver a ejecutar sin problema; vuelve a empezar desde el paso 1.
- Si el cliente v2 tiene un bug grave: revierte el despliegue del cliente, pero la base seguirá en v2 y el cliente v1 no es compatible; arregla hacia delante.
- Los clientes ya reseteados no se vuelven a resetear (guardan `orbita_schema_epoch = 2`). Para forzar otro reseteo local, sube `SCHEMA_EPOCH` en `src/lib/db/schemaEpoch.ts`.

## 5. Después

- `SUPABASE_SERVICE_ROLE_KEY` ya no lo usa `account.functions.ts`. Comprueba si algo más usa `client.server.ts` antes de quitar la variable del entorno.
- Mantén `supabase/migrations_archive/` solo como referencia; no la muevas de vuelta a `migrations/`.
