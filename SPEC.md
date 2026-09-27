# Trash Bash — River Cleanup Contest App

> Working name. Rename freely.

## What this is

A mobile-only web app for an annual Denver river cleanup (~160 volunteers, one day, once a year). Volunteers snap photos of what they pull out of the river and enter them into contest categories. Organizers/judges browse submissions on their phones, vote, and pick winners. Prizes are handed out on site.

**Design principle:** submitting should feel almost as easy as texting a photo. After the first submission, a repeat entry is: **tap → snap → pick category → send.**

## Goals

- A first-time volunteer can submit in under 45 seconds; repeat submissions in under 15.
- Zero photos lost to bad cell signal.
- Judges can score every submission in a category and see a ranked leaderboard without spreadsheets.
- Winners are verified at the prize tent with a short code, with no accounts.
- The app is reusable next year by editing a config file.

## Non-goals

- **No admin CMS.** Categories, event name, and dates live in a config file. The event happens once a year, so a UI for this isn't worth building.
- **No SMS/Twilio.** It's web only. Hazard alerts use a plain `sms:` link that opens the phone's own messaging app.
- **No volunteer accounts or passwords.**
- **No native app.**
- **No desktop layout.** It should not break on desktop, but mobile is the only target.

---

## Stack

- **Next.js** (App Router) + **Tailwind**, deployed on **Vercel** with a custom domain.
- **Supabase** for Postgres and Storage (bucket: `submissions`).
- All DB writes go through Next.js route handlers using the Supabase service role key (server-only). RLS is enabled with no public policies; the client never talks to the DB directly.
- Photos upload **directly from the browser to Supabase Storage via signed upload URLs**. They never pass through a Vercel function, which has a ~4.5MB body limit.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JUDGE_PASSCODE=            # shared passcode for /judge
SAFETY_LEAD_PHONE=         # receives hazard texts via sms: link
SUBMISSIONS_OPEN=true      # kill switch; also overridable in config
```

---

## Config (`/config/event.ts`)

Single source of truth for the event. Categories below are **placeholders to finalize**.

```ts
export const event = {
  name: "Trash Bash 2026",
  year: 2026,
  opensAt: "2026-XX-XXT08:00:00-06:00",
  closesAt: "2026-XX-XXT13:00:00-06:00",
  zones: ["A", "B", "C", "D", "E", "F"],  // match physical flags/signs on site
  categories: [
    { id: "weirdest",  label: "Weirdest Find",   emoji: "🤯", blurb: "The 'how did THIS get here?' award" },
    { id: "heaviest",  label: "Heaviest Haul",   emoji: "🏋️", blurb: "Weigh it at a scale station", requiresWeight: true },
    { id: "treasure",  label: "Trash to Treasure", emoji: "♻️", blurb: "Something that deserves a second life" },
    { id: "vintage",   label: "Time Capsule",    emoji: "⏳", blurb: "Oldest-looking item" },
    { id: "tiniest",   label: "Tiniest Trash",   emoji: "🔍", blurb: "Smallest recognizable object" },
  ],
};
```

Categories are **single-select** per submission. Volunteers can submit the same item again for another category if they want.

---

## Data model

### `submissions`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| code | text unique | Short human code, e.g. `B47`. Avoid ambiguous chars (0/O, 1/I). |
| event_year | int | From config |
| category_id | text | From config |
| photo_path | text | Storage path |
| name | text | |
| phone | text | |
| team_name | text null | Optional (families, groups, companies) |
| note | text null | Max 140 chars |
| weight_lbs | numeric null | Required when category `requiresWeight` |
| lat, lng | double null | From the browser Geolocation API |
| zone | text null | Manual fallback |
| is_minor | bool | |
| guardian_name, guardian_phone | text null | Required if `is_minor` |
| photo_consent | bool | OK to use the photo on social media |
| device_id | text | Random ID in localStorage; used for "my submissions" and light rate limiting |
| hidden | bool default false | Judges can hide duplicates or inappropriate photos |
| winner_rank | int null | 1 = winner; 2 or 3 optional runners-up |
| created_at | timestamptz | |

### `votes`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| submission_id | uuid fk | |
| judge_name | text | Entered once on /judge; stored in a cookie |
| score | int | 1–5 |
| created_at | timestamptz | |

Unique on `(submission_id, judge_name)`. Re-voting updates the score.

### `hazards` (P1)

| column | type | notes |
|---|---|---|
| id, lat, lng, zone, note, photo_path, created_at | | Logged in addition to the SMS to the safety lead |

---

## Volunteer experience

### Entry
- QR codes printed on signs, the check-in table, and bag tags open `/` directly.

### `/`: Submit (one screen, progressive)
1. A huge **"Snap your trash"** button that opens `<input type="file" accept="image/*" capture="environment">`.
2. After capture, a photo preview appears with a retake option.
3. **Category chips**, large and thumb-friendly, each with emoji and blurb.
4. **Weight (lbs)** field, shown and required only for categories with `requiresWeight`. Helper text: "Take it to a scale station."
5. **Location** is captured automatically on page load via `navigator.geolocation`. If location is denied or unavailable, show a zone picker (A–F). Do **not** rely on photo metadata for GPS, because mobile browsers often strip it.
6. **Note**: optional, one line.
7. **About you** (first submission only; saved to localStorage after that):
   - Name, phone, and optional team name.
   - A "Under 18?" toggle, which reveals guardian name and phone fields.
   - A photo-consent checkbox.
   - On later submissions, show "Submitting as **Calvin** · edit" instead of the full form.
8. **Send it** button.

### Confirmation
- A big code (**#B47**) with the message "Show this at the prize tent if you win."
- A "Snap another" button that returns to step 1 with contact info already filled.

### `/mine`: My submissions
- Lists this device's submissions with thumbnail, category, code, and upload status.

### Upload reliability (P0; cell signal at the site will be poor)
- **Compress on the device** before upload: resize to a 1600px long edge, JPEG quality around 0.7, targeting about 300–500KB.
- **Queue in IndexedDB.** Save the submission locally first, then upload. Retry with backoff automatically, and again on the `online` event and on page focus.
- Show status per submission: *Queued → Uploading → Sent ✓*. Never tell the user it was sent until the server confirms.
- **Idempotency:** the client generates the submission UUID, so retries never create duplicates.
- Flow: `POST /api/submissions/init` returns a signed upload URL and a code. The browser uploads to Storage, then calls `POST /api/submissions/complete`.

### Closed state
- Outside `opensAt`–`closesAt`, or when `SUBMISSIONS_OPEN=false`, show a friendly "Submissions are closed — thanks for hauling!" screen.

### Hazard button (P1)
- A persistent small **"⚠️ Found something dangerous?"** link.
- It opens a screen: "Don't touch it. Needles, chemicals, sharp metal — leave it and flag it."
- A button opens `sms:${SAFETY_LEAD_PHONE}?body=HAZARD at {lat},{lng} (Zone X): {note}` using the native messaging app, with no Twilio. It also logs a row to `hazards`.

---

## Judge experience (`/judge`)

- **Gate:** a passcode screen checks against `JUDGE_PASSCODE`, then asks for "Your name." Both are stored in an httpOnly cookie. Middleware protects `/judge/*` and `/api/judge/*`.
- **Category tabs** across the top, plus an **All** tab.
- **Feed:** a two-column photo grid, newest first, with a toggle to sort by score.
  - Each tile shows the photo, code, weight (if any), and the judge's own score badge.
- **Detail view** (tap a tile):
  - Full photo, pinch-to-zoom friendly.
  - Category, note, weight, zone or a map link, team name, and time.
  - A **1–5 score** row. Tapping a score saves it immediately.
  - The average score and vote count.
  - **Hide** (duplicate or inappropriate) and **Mark winner / runner-up** actions.
  - The contact section is hidden until the submission is marked as winner or runner-up. It then shows name and phone with `tel:` and `sms:` links (and guardian contact if a minor).
- **Leaderboard per category:** ranked by average score, then vote count, excluding hidden submissions.
- **Prize tent lookup:** a search box for code → submission detail.
- **Export:** `/api/judge/export.csv` returns all submissions for the sponsor/city report (counts by category, zones, weights).
- Refresh with polling every ~15s or pull-to-refresh. No realtime infrastructure needed at this scale.

## Live wall (`/wall`, P1)

- A full-screen slideshow of recent non-hidden photos for a TV or laptop at the HQ tent.
- Shows category and team name only, never contact info.
- Protected by a `?key=` query param equal to the judge passcode.

---

## Visual direction: trash bag theme

- **Base:** glossy contractor-bag black with a subtle plastic-sheen gradient or wrinkle texture.
- **Accents:** safety orange and hi-vis lime, like litter grabbers and safety vests.
- **Details:** twist-tie and drawstring motifs on buttons and dividers; category chips that look like bag tags.
- **Type:** chunky stencil or condensed display face for headings (e.g., a Google Font like "Bebas Neue" or "Black Ops One"); a clean sans for body text.
- **Copy voice:** playful and punny ("Bag it. Snap it. Send it.", "Trash talk welcome.").
- **Usability requirements:**
  - Must be readable in bright sun: high contrast, minimum 16px body text.
  - Tap targets at least 48px, since people may be wearing gloves and have wet hands.
  - Respect safe-area insets.
  - No hover-dependent UI.

---

## Privacy and data

- Contact info is visible only to judges, and only for winners and runners-up.
- The wall, feed tiles, and exports for social media never show phone numbers.
- Include `scripts/purge-contacts.sql` to null out `phone`, `guardian_phone`, and `name` for a given `event_year`. Run it after prizes are awarded.
- A photo is eligible for social media use only if `photo_consent = true`.

---

## Build phases (for Claude Code)

1. **Scaffold:**
   - Next.js + Tailwind + Supabase clients.
   - `config/event.ts`.
   - SQL migration for tables, indexes, and RLS enabled.
   - Storage bucket setup notes.
2. **Submit flow (happy path):** capture → compress → signed upload → complete → confirmation code.
3. **Reliability:** IndexedDB queue, retries, status UI, idempotent IDs, `/mine`.
4. **Judge side:** passcode gate, feed, detail, scoring, hide, winners, leaderboard, code lookup.
5. **Extras:** hazard flow, `/wall`, CSV export, purge script.
6. **Theme pass and field test:** test on real iOS Safari and Android Chrome with throttled network ("Slow 3G"). Submit 20 photos while toggling airplane mode.

## Acceptance checklist

- [ ] A fresh phone can submit in under 45 seconds; a repeat submission takes 3 taps after the photo.
- [ ] A submission made in airplane mode uploads automatically once back online, with no duplicate created.
- [ ] A 12MB photo from an iPhone uploads as under 600KB.
- [ ] "Heaviest" cannot be submitted without a weight.
- [ ] A minor cannot be submitted without guardian name and phone.
- [ ] `/judge` is inaccessible without the passcode, and contact info never appears in any public page or API response.
- [ ] A code lookup at the prize tent finds the submission in under 5 seconds.
- [ ] The closed state appears outside the event window.

## Open questions

- **Final categories and prizes.** Are runners-up needed?
- **Event date and hours.** These set `opensAt` and `closesAt`.
- **Domain name.**
- **Zones.** How many zones, and which signage matches them?
- **Hazard contact.** Who is the safety lead receiving hazard texts?
- **Photo consent.** Will the event's existing volunteer waiver already cover photo consent? If so, the checkbox can be dropped.
