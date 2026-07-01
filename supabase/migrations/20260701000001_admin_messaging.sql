-- =====================================================================
-- ADMIN MESSAGING + RLS FIX
-- Run this in the Supabase SQL Editor.
--
-- Fixes a bug: whatsapp_sessions and waitlist have RLS enabled with NO
-- policy for the `authenticated` role, so the admin dashboard (which uses
-- the anon key + a logged-in session) has been silently getting empty
-- results for Dashboard/Students/Leads/Waitlist — even though the data
-- exists (verified via service-role query). Only service_role could ever
-- read these tables. This adds admin-gated read policies.
--
-- Also: the real admin login (kyal.stahl@tutanota.com) was never added to
-- admin_allowlist, so is_admin() would have returned false for them even
-- with a policy in place. Adding it here.
--
-- Also adds an admin_messages table to log outbound WhatsApp messages sent
-- from the dashboard (who sent what, to whom, when, and delivery status).
-- =====================================================================

-- 1. Add the real admin to the allowlist (placeholder stays too — harmless).
insert into admin_allowlist (email) values ('kyal.stahl@tutanota.com')
  on conflict (email) do nothing;

-- 2. Admin-gated read access to whatsapp_sessions (learner data + progress).
--    Still no write access from the client — sends go through the backend
--    using the service-role key, never directly from the browser.
create policy "admin read whatsapp_sessions" on whatsapp_sessions
  for select to authenticated using (public.is_admin());

-- 3. Admin-gated read access to waitlist.
create policy "admin read waitlist" on waitlist
  for select to authenticated using (public.is_admin());

-- 4. Outbound message log.
create table if not exists admin_messages (
  id          uuid primary key default gen_random_uuid(),
  sent_by     text not null,           -- admin email
  to_phone    text not null,           -- whatsapp:+27...
  body        text not null,
  status      text not null,           -- 'sent' | 'failed'
  twilio_sid  text,
  error       text,
  created_at  timestamptz not null default now()
);
alter table admin_messages enable row level security;

-- Admins can read the log (inserts happen server-side via service role,
-- which bypasses RLS, so no insert policy is needed for the client).
create policy "admin read admin_messages" on admin_messages
  for select to authenticated using (public.is_admin());

create index if not exists idx_admin_messages_to_phone on admin_messages(to_phone);
create index if not exists idx_admin_messages_created_at on admin_messages(created_at desc);
