-- =====================================================================
-- SECURITY FIX: sponsor_matches and reengagement_queue were created this
-- session with `for select using (true)` / role `public` — the same
-- insecure pattern SECURITY_REVIEW.md's Finding #1 flagged as Critical and
-- that every other table was subsequently locked down to `is_admin()` +
-- `authenticated`. These two tables were missed at creation time (copied
-- from the pre-fix colleges/courses migration instead of the current
-- pattern) and were live on production, readable by anyone holding the
-- public anon key (which ships in the admin JS bundle), including real
-- learner phone numbers. Closing that gap here.
-- =====================================================================

drop policy if exists "Admins can view sponsor matches" on sponsor_matches;
create policy "admin read sponsor_matches" on sponsor_matches
  for select to authenticated using (is_admin());

drop policy if exists "Admins can view reengagement queue" on reengagement_queue;
create policy "admin read reengagement_queue" on reengagement_queue
  for select to authenticated using (is_admin());
