# Cleaner Clear Photo Contest

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
3. Edit [`config/event.ts`](config/event.ts) for this year's dates, (optional) zones and categories.

## Environment variables

- **Local dev:** put them in `.env.local` at the repo root (next to `package.json`). Start from `cp .env.example .env.local`. The file is gitignored — never commit it. Restart `npm run dev` after editing.
- **Vercel:** Project → Settings → Environment Variables. Add the same keys for Production (and Preview if you use preview deploys), then redeploy.

## Testing before event day

The submit form only appears between `opensAt` and `closesAt` in `config/event.ts`. To try it any other time, set `SUBMISSIONS_OPEN=always` in `.env.local` and restart `npm run dev`. Test entries go into your real Supabase project; delete them in the Table Editor (and Storage) afterwards.

To test on your phone: run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer's-IP>:3000` on the same Wi-Fi. Location won't work over plain http. That's expected, and the form works without it.

## Yearly re-skin

- `config/event.ts` — name, dates, optional zones, categories.
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
