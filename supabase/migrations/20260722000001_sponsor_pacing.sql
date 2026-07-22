-- =====================================================================
-- SPONSOR PACING — make the contractual impression floor observable.
--
-- Clause 3.5 of the sponsorship agreement commits Vula to extending a
-- sponsor's term free of charge if delivered impressions fall below an
-- agreed Minimum Impression Floor. That floor was recorded only on paper
-- in Schedule A, so there was no way to see a sponsor tracking behind
-- until the term had already ended and the liability had crystallised.
--
-- This adds the floor and term dates to `colleges`, and a view that
-- reports pace against them, so under-delivery surfaces while there is
-- still term left to correct it.
--
-- Related: lib/assessment.js findSponsorMatch() rotates delivery between
-- comparably-matched sponsors, which is what makes a floor honourable at
-- all — before rotation the highest-scoring sponsor took every impression
-- in its province and everyone else was structurally stuck at zero.
-- =====================================================================

alter table colleges add column if not exists impression_floor int;
alter table colleges add column if not exists term_start date;
alter table colleges add column if not exists term_end   date;

comment on column colleges.impression_floor is
  'Minimum floor agreed in Schedule A for the current term, counted in DISTINCT LEARNERS REACHED (not raw placement views). NULL = no floor agreed, in which case clause 3.3 applies without qualification and no make-good is owed.';
comment on column colleges.term_start is 'First day of the current Sponsorship Term (Schedule A).';
comment on column colleges.term_end   is 'Last day of the current Sponsorship Term (Schedule A).';

create index if not exists idx_colleges_term_end on colleges(term_end);

-- ---------------------------------------------------------------------
-- Pacing view: one row per sponsoring college with a floor and a term.
--
-- The floor is measured in LEARNERS REACHED (distinct phone numbers), not
-- raw placement views. advance() logs a row every time a learner opens a
-- career detail, so one person browsing their six matches back and forth
-- can generate a dozen rows. Counting those as "impressions" would make the
-- floor trivially easy to hit and impossible to defend if a sponsor audited
-- it — and a recruitment director is buying people reached, not page views.
-- `views` is exposed alongside for engagement analysis, but the contractual
-- number is `delivered`.
--
-- `expected_to_date` is a straight pro-rata of the floor across the term.
-- It is a pacing signal, not a contractual measure — clause 3.5 is only
-- assessed at end of term. The point is early warning.
-- ---------------------------------------------------------------------
create or replace view sponsor_pacing
with (security_invoker = on) as
select
  c.id                as college_id,
  c.name              as college_name,
  c.province,
  c.impression_floor,
  c.term_start,
  c.term_end,
  greatest(c.term_end - c.term_start, 1)                          as term_days,
  greatest(least(current_date, c.term_end) - c.term_start, 0)     as days_elapsed,
  coalesce(m.delivered, 0)                                        as delivered,
  coalesce(m.views, 0)                                            as views,
  ceil(
    c.impression_floor::numeric
    * greatest(least(current_date, c.term_end) - c.term_start, 0)::numeric
    / greatest(c.term_end - c.term_start, 1)::numeric
  )::int                                                          as expected_to_date,
  coalesce(m.delivered, 0) - ceil(
    c.impression_floor::numeric
    * greatest(least(current_date, c.term_end) - c.term_start, 0)::numeric
    / greatest(c.term_end - c.term_start, 1)::numeric
  )::int                                                          as variance,
  case
    when current_date > c.term_end and coalesce(m.delivered, 0) < c.impression_floor
      then 'BREACH — term ended below floor, make-good owed (3.5)'
    when coalesce(m.delivered, 0) >= c.impression_floor then 'MET'
    when coalesce(m.delivered, 0) >= ceil(
           c.impression_floor::numeric
           * greatest(least(current_date, c.term_end) - c.term_start, 0)::numeric
           / greatest(c.term_end - c.term_start, 1)::numeric) then 'ON TRACK'
    else 'BEHIND'
  end                                                             as status
from colleges c
left join (
  select
    college_id,
    count(distinct phone) as delivered,  -- unique learners reached (contractual)
    count(*)              as views       -- raw placement views (engagement only)
  from sponsor_matches
  group by college_id
) m on m.college_id = c.id
where c.active
  and c.impression_floor is not null
  and c.term_start is not null
  and c.term_end is not null;

comment on view sponsor_pacing is
  'Delivery against the Schedule A floor for each active sponsor. `delivered` = distinct learners reached (the contractual measure); `views` = raw placement views (engagement only). status: MET | ON TRACK | BEHIND | BREACH. Pro-rata expectation is an early-warning signal; clause 3.5 is assessed at end of term.';

-- The view is security_invoker, so the querying user's RLS on the
-- underlying tables applies — admin-only, matching colleges/sponsor_matches.
revoke all on sponsor_pacing from anon;
grant select on sponsor_pacing to authenticated;

-- ---------------------------------------------------------------------
-- Province capacity: are we oversold?
--
-- Rotation (lib/assessment.js selectSponsor) splits a finite pool of
-- learners between comparably-matched sponsors. Every floor sold in a
-- province is therefore a claim on the same pool, and selling one more
-- sponsor makes every existing floor harder to hit. This view is the
-- guardrail: it sums committed floors per province against learners
-- actually reached there, so "can we take another sponsor in Gauteng?"
-- is answered with a number rather than a hunch.
--
-- `committed_floor` is the total we would owe make-goods on if nobody
-- was reached. `distinct_learners` is what the province has actually
-- delivered to date, across all sponsors.
-- ---------------------------------------------------------------------
create or replace view province_capacity
with (security_invoker = on) as
select
  coalesce(c.province, 'National')            as province,
  count(*)                                    as active_sponsors,
  sum(c.impression_floor)                     as committed_floor,
  coalesce(m.distinct_learners, 0)            as distinct_learners_reached,
  case
    when coalesce(m.distinct_learners, 0) = 0 then null
    else round(coalesce(m.distinct_learners, 0)::numeric / nullif(sum(c.impression_floor), 0), 2)
  end                                         as coverage_ratio,
  case
    when coalesce(m.distinct_learners, 0) >= sum(c.impression_floor) then 'COVERED'
    when coalesce(m.distinct_learners, 0) >= sum(c.impression_floor) * 0.5 then 'TIGHT — do not add sponsors here'
    else 'OVERSOLD — existing floors at risk'
  end                                         as capacity_status
from colleges c
left join lateral (
  select count(distinct sm.phone) as distinct_learners
  from sponsor_matches sm
  where sm.province is not distinct from c.province
) m on true
where c.active
  and c.impression_floor is not null
group by c.province, m.distinct_learners;

comment on view province_capacity is
  'Committed impression floors per province against learners actually reached there. Rotation splits a finite pool, so every additional sponsor in a province makes every existing floor harder to meet. Check this before onboarding another sponsor in the same province — and prefer sponsors in non-overlapping faculties, which roughly triples effective capacity.';

revoke all on province_capacity from anon;
grant select on province_capacity to authenticated;
