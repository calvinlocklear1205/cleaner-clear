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

## Pages

| URL | Who | What |
|---|---|---|
| `/` | Volunteers | Snap → category → send. Closed screen outside the event window. |
| `/mine` | Volunteers | This phone's entries, codes and upload status. |
| `/a/<code>` | Anyone with the link | A volunteer's shared "trash album": photos, stats, wins. Created from "Mine". |
| `/hazard` | Volunteers | "Don't touch it" + prefilled text to the safety lead. |
| `/judge` | Judges (passcode) | Photo feed by category, scoring, hide, awards, prize-tent code lookup. |
| `/judge/leaderboard` | Judges | Ranked per category, totals, CSV download. |
| `/wall?key=<JUDGE_PASSCODE>` | HQ tent TV | Full-screen slideshow (category + team name only). Click for full screen. |

## Open early, then clear test photos

The site opens on 2026-09-27 (`opensAt` in `config/event.ts`) so the team can try it for real, and closes after the event. With `SUBMISSIONS_OPEN=true` in Vercel there is nothing else to switch on.

Clearing test entries, all from a phone:
- **One entry:** Judges → open it → **Delete entry**.
- **Everything:** Judges → Leaderboard → **Start fresh** → type `DELETE`. Removes every entry, photo, score and hazard report for the year. Volunteers' "Mine" lists clear themselves.
- From a computer instead: `npm run reset-test-data` (dry run), then `npm run reset-test-data -- --yes`.

`SUBMISSIONS_OPEN=always` (open regardless of dates, shows a striped TEST MODE banner) is still available for testing outside the window.

## Event-day runbook

- **Before:** check `SUBMISSIONS_OPEN=true` in Vercel, clear test photos (Start fresh), print QR codes pointing at the site.
- **Judges:** share the site + `/judge` and the passcode. Each judge enters their own name; scores are kept per judge.
- **Kill switch:** set `SUBMISSIONS_OPEN=false` in Vercel and redeploy, or flip `submissionsOpen` in `config/event.ts` and push.
- **Hazard reports** go by text to `SAFETY_LEAD_PHONE` and are also logged in the `hazards` table (Supabase → Table Editor).
- **After prizes:** download the CSV, then run `scripts/purge-contacts.sql` in the Supabase SQL Editor.

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
lib/client/queue.ts      offline-first upload queue (IndexedDB)
lib/judge-auth.ts        signed judge session cookie
proxy.ts                 gate for /judge and /api/judge
scripts/purge-contacts.sql  wipe names/phones after the event
supabase/migrations/     SQL schema, RLS, storage bucket
docs/SUPABASE.md         project + bucket setup notes
```
