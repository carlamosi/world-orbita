# World Orbita

Cinematic geography mastery platform — 195 countries, every capital, every flag, explored from orbit.

## Stack

- **Frontend:** React 19, TanStack Start/Router, Tailwind CSS, Framer Motion
- **3D Globe:** react-globe.gl + Three.js
- **Local-first DB:** Dexie (IndexedDB) with per-user DB swap on auth
- **Spaced repetition:** FSRS engine (`src/lib/fsrs/`)
- **Backend / sync:** Supabase Auth + RPC sync (`sync_push` / `sync_pull`)
- **OAuth:** Google via Lovable Cloud Auth

## Project structure

```
src/
  lib/fsrs/          FSRS algorithm (engine, planner, assessment, migration)
  lib/db/            Dexie schema, progress repo, per-user dbProvider
  lib/sync/          Outbox queue, push/pull workers, guest migration
  lib/auth/          Profile ensure, guest → signed-in progress merge
  features/          Game modes (find, name, flags, capitals, speed, challenges)
  integrations/      Supabase client, auth middleware, Lovable OAuth
supabase/
  migrations/        Full SQL schema (profiles, concept_progress, sync RPCs)
  config.toml        Supabase project config
```

## Getting started

```bash
npm install
npm run dev
```

Environment variables (see `.env`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase access |

## Supabase

Apply migrations locally or link to the hosted project:

```bash
npx supabase link --project-ref iwnurgbgjjlegdtrqrwq
npx supabase db push
```

## Auth & progress sync

- **Guest:** progress stored in IndexedDB (`orbita-local`)
- **Signed in:** DB swaps to `orbita-${userId}`; guest data merges on `SIGNED_IN`
- **Cloud:** dirty rows queued in outbox → pushed via `sync_push` RPC

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
