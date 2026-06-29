-- Waitlist signups (pre-launch). Run in the Supabase SQL Editor.
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null,
  source     text,
  created_at timestamptz not null default now()
);

-- Lock to the service role only (the backend inserts; no public access).
alter table waitlist enable row level security;
