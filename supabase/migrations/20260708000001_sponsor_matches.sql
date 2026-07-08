-- =====================================================================
-- SPONSOR MATCH LOG — records every time a sponsor college/course is
-- actually shown to a learner, together with a snapshot of that
-- learner's assessment outcome (RIASEC scores, top traits, matched
-- career, grade/province/city/suburb/age at the time of the match).
--
-- Why a new table instead of the old `recommendations` table: the
-- original schema's `recommendations` FKs to `assessments(id)`, but
-- `students`/`assessments` were abandoned in favour of the simpler
-- `whatsapp_sessions` JSONB session store (see lib/assessment.js) —
-- resurrecting the relational tables would mean writing to two parallel
-- data models. This table keys off `phone` instead, matching the
-- architecture actually in production.
--
-- Purpose: lets admin later analyse which institutions/courses match
-- which kinds of learners (by trait profile, grade, location) — i.e.
-- "match the institution and their course with the learners' outcomes."
-- =====================================================================

create table if not exists sponsor_matches (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  college_id uuid not null references colleges(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  career_id text not null,
  match_score int,
  riasec_scores jsonb,
  top_traits text[],
  grade int,
  age int,
  province text,
  city text,
  suburb text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sponsor_matches_college on sponsor_matches(college_id);
create index if not exists idx_sponsor_matches_course on sponsor_matches(course_id);
create index if not exists idx_sponsor_matches_phone on sponsor_matches(phone);
create index if not exists idx_sponsor_matches_career on sponsor_matches(career_id);

alter table sponsor_matches enable row level security;

create policy "Admins can view sponsor matches" on sponsor_matches
  for select using (true);

comment on table sponsor_matches is 'One row per sponsor college/course impression shown to a learner, with a snapshot of that learner''s assessment outcome at the time.';
