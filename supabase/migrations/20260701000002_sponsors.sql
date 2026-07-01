-- =====================================================================
-- SPONSOR MODEL — city-based matching for sponsor colleges/courses.
-- Run this in the Supabase SQL Editor.
--
-- Vula's revenue model is sponsorship, not lead sales: institutions pay to
-- have their courses surfaced to learners in the WhatsApp career-detail
-- view, filtered to the learner's city (or shown nationally). The
-- `colleges`/`courses` tables already exist (20260628000001) and already
-- have admin-only RLS policies (20260629000001) — this just adds the
-- columns needed for city + active-status filtering.
-- =====================================================================

alter table colleges add column if not exists city text;
alter table colleges add column if not exists active boolean not null default true;

alter table courses add column if not exists active boolean not null default true;

create index if not exists idx_colleges_city on colleges(city);
create index if not exists idx_colleges_active on colleges(active);
create index if not exists idx_courses_active on courses(active);

comment on column colleges.city is 'Canonical city from lib/cities.js CITIES list. NULL/''Other'' = shown to learners nationwide, not city-filtered.';
