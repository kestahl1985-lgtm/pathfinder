-- =====================================================================
-- SECURITY HARDENING — replace permissive RLS with admin-only access
-- Run this in the Supabase SQL Editor.
--
-- Problem fixed: the original policies used `USING (true)`, which allowed
-- the PUBLIC anon key (shipped in the admin's browser bundle) to read all
-- learner PII and update leads — with no login required.
--
-- After this migration: only authenticated users whose email is in
-- `admin_allowlist` can read/manage data. The WhatsApp bot is unaffected
-- because it uses the service-role key, which bypasses RLS.
-- =====================================================================

-- 1. Allowlist of admin emails (who may access the dashboard data)
create table if not exists admin_allowlist (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table admin_allowlist enable row level security;  -- no anon policy => anon denied

-- >>> Seed your real admin email(s) here <<<
insert into admin_allowlist (email) values ('admin@pathfinder.local')
  on conflict (email) do nothing;

-- 2. Helper: is the current caller an allow-listed admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 3. Drop the old world-readable policies
drop policy if exists "Admins can view students"    on students;
drop policy if exists "Admins can view assessments" on assessments;
drop policy if exists "Admins can view leads"       on leads;
drop policy if exists "Admins can update leads"     on leads;
drop policy if exists "Admins can view colleges"    on colleges;
drop policy if exists "Admins can view courses"     on courses;

-- 4. New admin-only policies (read sensitive tables; manage operational ones)
-- Read-only for learner data:
create policy "admin read students"     on students             for select to authenticated using (public.is_admin());
create policy "admin read assessments"  on assessments          for select to authenticated using (public.is_admin());
create policy "admin read responses"    on assessment_responses for select to authenticated using (public.is_admin());
create policy "admin read recommends"   on recommendations      for select to authenticated using (public.is_admin());

-- Leads: read + update status:
create policy "admin read leads"   on leads for select to authenticated using (public.is_admin());
create policy "admin update leads" on leads for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Institutions / courses / assignments / logs: full admin management:
create policy "admin manage colleges"    on colleges           for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage courses"     on courses            for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage assignments" on manual_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage logs"        on admin_logs         for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. admin_users table: keep locked to service role only (no anon/auth policy).
--    whatsapp_sessions already has RLS enabled with no policy => service role only. Good.

-- 6. Safety: ensure RLS is on for every table holding personal data
alter table students             enable row level security;
alter table assessments          enable row level security;
alter table assessment_responses enable row level security;
alter table recommendations      enable row level security;
alter table leads                enable row level security;
alter table colleges             enable row level security;
alter table courses              enable row level security;
alter table manual_assignments   enable row level security;
alter table admin_logs           enable row level security;
alter table admin_users          enable row level security;
