-- =====================================================================
-- COURSE PROSPECTUS — lets an admin attach an actual PDF to a course,
-- delivered to matching learners as a real WhatsApp document (not just a
-- website link). Run this in the Supabase SQL Editor.
-- =====================================================================

alter table courses add column if not exists prospectus_url text;
comment on column courses.prospectus_url is 'Public URL of the uploaded prospectus PDF in the prospectuses storage bucket. NULL = no document attached, learner only sees the website link (if any).';

-- Public bucket: files must be fetchable by Twilio/Meta's servers without
-- auth to be attached as a WhatsApp document, same reasoning as /report's
-- publicly-reachable (but unguessable-token) URL. Prospectuses are an
-- institution's own marketing material, not learner PII, so a plain public
-- URL (no token needed) is appropriate here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prospectuses', 'prospectuses', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Uploads/replacements/deletes are admin-only; reads are public (the bucket's
-- own public=true flag already serves GET without RLS, this is defense in
-- depth in case that ever changes).
drop policy if exists "Public read prospectuses" on storage.objects;
create policy "Public read prospectuses"
  on storage.objects for select
  using (bucket_id = 'prospectuses');

drop policy if exists "Admins can upload prospectuses" on storage.objects;
create policy "Admins can upload prospectuses"
  on storage.objects for insert
  with check (bucket_id = 'prospectuses' and is_admin());

drop policy if exists "Admins can update prospectuses" on storage.objects;
create policy "Admins can update prospectuses"
  on storage.objects for update
  using (bucket_id = 'prospectuses' and is_admin());

drop policy if exists "Admins can delete prospectuses" on storage.objects;
create policy "Admins can delete prospectuses"
  on storage.objects for delete
  using (bucket_id = 'prospectuses' and is_admin());
