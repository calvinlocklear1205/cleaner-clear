-- Shareable "trash albums": one public link per volunteer device per year.
-- Same lockdown as the other tables: RLS on, no policies, no client grants;
-- only the server (service role) reads or writes.

create table public.albums (
  -- Random, unguessable id used in the public URL (/a/<slug>).
  slug        text primary key check (slug ~ '^[a-z0-9]{12}$'),
  event_year  int  not null,
  -- Same random id as submissions.device_id; never shown publicly.
  device_id   text not null check (char_length(device_id) between 8 and 64),
  -- Chosen by the volunteer, e.g. "Calvin's Trashy Day". The only name shown.
  title       text not null check (char_length(title) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- "Stop sharing" sets this; the link then 404s.
  revoked_at  timestamptz,
  constraint albums_year_device_key unique (event_year, device_id)
);

create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();

alter table public.albums enable row level security;
alter table public.albums force row level security;
revoke all on public.albums from anon, authenticated;
