-- Tracks whether/when an admin has sent the welcome_optin WhatsApp template
-- to a waitlist contact, so the admin UI can show invite status and avoid
-- accidental re-sends. See api/waitlist-invite.js.
alter table waitlist
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by text;
