# Runbook: acotar el reloj del cliente en `sync_push`

Aplica `supabase/migrations/20261107000000_sync_push_clamp_last_review.sql` en producción. La aplicas tú a mano; nada del código lo hace.

**Proyecto de producción: `aqwfmmhfiqjvyaufjcsk`.** Antes de ejecutar nada, comprueba en el Dashboard que la URL del proyecto abierto lo contiene.

## Qué hace

Gana siempre la revisión con `fsrs_last_review` más reciente. Un dispositivo con el reloj adelantado (días o años) fijaba ese valor y bloqueaba para siempre las revisiones de los demás dispositivos. La migración reemplaza `sync_push` (misma firma, `security invoker`, `search_path = public`, `auth.uid()`) y solo cambia una línea: el `fsrs_last_review` entrante se acota a `now() + 5 minutos` antes de guardarlo y de compararlo. No toca tablas ni datos, y los permisos de la función se conservan. Las filas que ya tengan una fecha futura no se corrigen solas.

Requisito: el baseline v2 ya está aplicado (ver `supabase-v2-reset.md`).

## 1. Elige un camino

### Camino A: SQL editor del Dashboard

1. Dashboard > SQL Editor > New query. Pega el contenido completo de `supabase/migrations/20261107000000_sync_push_clamp_last_review.sql` y ejecuta (Run).
2. Nueva query, registra la migración en el historial (así `supabase db push` no la reaplica):

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20261107000000', 'sync_push_clamp_last_review')
on conflict (version) do nothing;
```

   Si da error de esquema inexistente, ignóralo.

### Camino B: CLI

1. `npx supabase link --project-ref aqwfmmhfiqjvyaufjcsk` y comprueba con `npx supabase projects list` que el marcado con ● es ese.
2. `supabase db push` (aplica solo la migración nueva).
3. `supabase migration list`: local y remoto deben mostrar `20261106000000` y `20261107000000`.

## 2. Verificación

1. La función contiene el recorte (debe devolver `true`):

```sql
select pg_get_functiondef('public.sync_push(jsonb)'::regprocedure)
  like '%now() + interval ''5 minutes''%';
```

2. Sigue ejecutable solo por `authenticated` (el `proacl` no debe incluir `anon` ni vacío antes de `=`):

```sql
select proacl, prosecdef from pg_proc
where oid = 'public.sync_push(jsonb)'::regprocedure;
```

   `prosecdef` debe ser `false` (security invoker).

3. Opcional, filas ya adelantadas (no las corrige la migración; solo informa):

```sql
select user_id, concept_id, fsrs_last_review from public.concept_progress
where fsrs_last_review > now() + interval '5 minutes';
```

## 3. Rollback

Vuelve a crear la función del baseline: pega en el SQL editor el bloque `create function public.sync_push` de `supabase/migrations/20261106000000_baseline_v2.sql` (desde `-- ===== sync_push` hasta su `end $$;`) cambiando `create function` por `create or replace function`. Si registraste la migración en el historial, bórrala:

```sql
delete from supabase_migrations.schema_migrations where version = '20261107000000';
```
