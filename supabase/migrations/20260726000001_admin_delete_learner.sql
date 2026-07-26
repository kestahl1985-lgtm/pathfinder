-- =====================================================================
-- ADMIN — allow deleting a learner and all their data.
--
-- The learner-facing DELETE command (lib/assessment.js deleteSession) already
-- erases a learner across whatsapp_sessions, sponsor_matches and
-- reengagement_queue using the service-role key. The admin UI does the same
-- cascade from the browser via the anon key, so it needs matching DELETE
-- policies — these three tables currently expose only SELECT to admins.
--
-- This is also the POPIA right-to-erasure control from the admin side: an
-- operator can honour a deletion request without waiting for the learner to
-- send DELETE themselves.
-- =====================================================================

create policy "admin delete whatsapp_sessions" on whatsapp_sessions
  for delete to authenticated using (public.is_admin());

create policy "admin delete sponsor_matches" on sponsor_matches
  for delete to authenticated using (public.is_admin());

create policy "admin delete reengagement_queue" on reengagement_queue
  for delete to authenticated using (public.is_admin());
