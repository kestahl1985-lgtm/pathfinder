-- =====================================================================
-- RE-ENGAGEMENT QUEUE — backs the admin "Re-engagement Schedule" screen.
--
-- api/reengage.js (Vercel Cron, daily) decides who's due for a re-engagement
-- nudge and inserts them here as 'pending'. Sending is deliberately manual:
-- an admin reviews the queue and triggers the actual WhatsApp send via
-- api/reengage-action.js, which flips the row to 'sent' (or an admin can
-- mark a row 'skipped' without sending). See api/reengage.js's file header
-- for why this isn't auto-sent.
-- =====================================================================

create table if not exists reengagement_queue (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  status text not null default 'pending', -- pending | sent | skipped
  queued_at timestamptz not null default now(),
  actioned_at timestamptz,
  actioned_by text
);

create index if not exists idx_reengagement_queue_status on reengagement_queue(status);
create index if not exists idx_reengagement_queue_phone on reengagement_queue(phone);

alter table reengagement_queue enable row level security;

create policy "Admins can view reengagement queue" on reengagement_queue
  for select using (true);

comment on table reengagement_queue is 'Learners due for a re-engagement WhatsApp nudge, queued by api/reengage.js, actioned (sent/skipped) manually by an admin via api/reengage-action.js.';
