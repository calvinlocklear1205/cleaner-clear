-- Purge volunteer contact info after prizes are awarded.
--
-- 1. Export anything you still need first (Judge → Leaderboard → Download CSV;
--    it never includes names or phone numbers anyway).
-- 2. Set the year below, paste into Supabase → SQL Editor, and run.
--
-- Keeps photos, categories, scores, weights and team names so the contest
-- history and sponsor numbers survive. Irreversible.

begin;

update public.submissions
set name               = null,
    phone              = null,
    guardian_name      = null,
    guardian_phone     = null,
    contacts_purged_at = now()
where event_year = 2026          -- ← the year to purge
  and contacts_purged_at is null;

-- Hazard reports carry a device id, not contact info, but clear it too.
update public.hazards set device_id = null where event_year = 2026;

-- Sanity check: should return 0.
select count(*) as rows_still_with_contacts
from public.submissions
where event_year = 2026
  and (name is not null or phone is not null or guardian_phone is not null);

commit;
