# Supabase setup

## 1. Create the project

1. Create a new project at <https://supabase.com/dashboard>. Pick region **West US (Oregon)** or **Central US** — closest to Denver.
2. Copy two values into `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`. Click the green **Connect** button at the top of the dashboard, or go to Settings → Data API. It looks like `https://<project-id>.supabase.co`.
   - **Secret key** → `SUPABASE_SERVICE_ROLE_KEY` (server only). Go to Settings → API Keys → **Secret keys**, and copy the `default` key (starts with `sb_secret_`). The legacy `service_role` JWT also works.

   The publishable / `anon` key is **not used** by this app. The browser never talks to Supabase except to PUT a photo to a pre-signed upload URL.

## 2. Run the migration

Either:

- **SQL editor (simplest):** paste `supabase/migrations/20260927000000_init.sql` into Dashboard → SQL Editor and run it. It is safe to re-run only on an empty project (the `create table` statements are not `if not exists`).
- **Supabase CLI:**
  ```sh
  npx supabase login
  npx supabase link --project-ref YOUR-PROJECT-REF
  npx supabase db push
  ```

The migration creates `submissions`, `votes`, `hazards`, their indexes and constraints, enables (and forces) RLS with **no policies**, revokes all privileges from `anon`/`authenticated`, and creates the storage bucket.

### Verify the lockdown

In the SQL editor:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class where relname in ('submissions', 'votes', 'hazards');
-- all three: t, t

select count(*) from pg_policies where schemaname = 'public';
-- 0
```

And from a terminal, the publishable key must get nothing back:

```sh
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/submissions?select=*" \
  -H "apikey: $PUBLISHABLE_KEY"
# → permission denied (42501)
```

## 3. Storage bucket: `submissions`

The migration inserts the bucket for you. If you'd rather click through the dashboard (**Storage → New bucket**), match these settings exactly:

| Setting | Value | Why |
|---|---|---|
| Name | `submissions` | Referenced as `SUBMISSIONS_BUCKET` in `lib/supabase/server.ts` |
| Public bucket | **Off** | Photos are served to judges/the wall via short-lived signed URLs |
| File size limit | 5 MB | Client compresses to ~300–500 KB; this is a backstop |
| Allowed MIME types | `image/jpeg, image/png, image/webp` | Client always re-encodes to JPEG; HEIC is rejected (not viewable in Chrome) |

**Do not add any storage policies.** How access works without them:

- **Upload:** `POST /api/submissions/init` (service role) calls `createSignedUploadUrl(path)`. The browser `PUT`s the compressed JPEG straight to that URL — it never passes through Vercel (4.5 MB body limit). The token is single-path and expires in 2 hours.
- **Read:** judge pages / `/wall` call `createSignedUrl(path, ttl)` server-side.
- **List/delete:** service role only.

### Path convention

```
submissions/                      ← bucket
  2026/<submission_uuid>.jpg      ← contest photos (1600px)
  2026/<submission_uuid>_thumb.jpg ← 480px thumbnail for the judges' grid (optional)
  2026/hazards/<hazard_uuid>.jpg  ← hazard photos (P1)
```

Prefixing by year makes it easy to download or delete one year's photos.

### CORS

Supabase Storage accepts browser `PUT`s from any origin for signed upload URLs; no CORS configuration is needed.

## 4. After the event

- Run `scripts/purge-contacts.sql` once prizes are awarded (edit the year first).
- Export anything the sponsor/city needs via `/api/judge/export.csv` first.
