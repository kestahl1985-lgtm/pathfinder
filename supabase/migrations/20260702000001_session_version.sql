-- Optimistic-concurrency guard for whatsapp_sessions. Prevents lost updates
-- when two webhook requests for the same phone number race each other
-- (e.g. a Twilio retry landing alongside the original request).
alter table whatsapp_sessions
  add column if not exists version integer not null default 1;
