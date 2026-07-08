-- =====================================================================
-- SPONSOR MATCHING: switch from city to province.
--
-- The onboarding flow dropped its "suburb" question (lib/assessment.js),
-- which is what colleges.city-based matching relied on (city was a
-- best-effort derivation from the suburb answer). Province is now the only
-- geographic signal collected from learners, so sponsor matching
-- (findSponsorMatch in lib/assessment.js) switches to it.
--
-- colleges.city is left in place, unused going forward — no real sponsor
-- colleges had been onboarded yet, so there's no data to migrate and no
-- reason to force a destructive drop.
-- =====================================================================

alter table colleges add column if not exists province text;

create index if not exists idx_colleges_province on colleges(province);

comment on column colleges.province is 'Canonical province from lib/provinces.js PROVINCES list. NULL/''Other'' = shown to learners nationwide, not province-filtered. Replaces the earlier city-based matching (colleges.city, now unused).';
