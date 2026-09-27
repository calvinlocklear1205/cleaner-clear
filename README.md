# A Cleaner Clear — River Cleanup Contest

Mobile web app for the annual Denver river cleanup. Volunteers snap photos of what they pull out of the river and enter contest categories; judges score them on their phones and pick winners. See [`SPEC.md`](SPEC.md) for the full product spec.

**Stack:** Next.js (App Router) · Tailwind v4 · Supabase (Postgres + Storage) · Vercel

## Setup

```sh
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

1. Create the Supabase project, run the migration, and check the storage bucket — see [`docs/SUPABASE.md`](docs/SUPABASE.md).
2. Fill in `.env.local` (and the same keys in Vercel).
3. Edit [`config/event.ts`](config/event.ts) for this year's dates, zones and categories.

## Yearly re-skin

- `config/event.ts` — name, dates, zones, categories.
- `app/globals.css` `@theme` block — color tokens (2026 palette is pulled from the badge).
- `public/brand/badge-<year>.webp`, `app/icon.png`, `app/apple-icon.png` — artwork.

## Layout

```
app/                     routes (App Router)
config/event.ts          event config — the only thing to edit each year
lib/env.ts               server-only env access
lib/supabase/server.ts   service-role client (server-only)
supabase/migrations/     SQL schema, RLS, storage bucket
docs/SUPABASE.md         project + bucket setup notes
```
