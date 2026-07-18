-- ============================================================
-- Link the EPRHA Fire Cracker Classic 2026 classes to real NRHA
-- class codes.
--
-- The 60 classes carry their NRHA codes as FREE TEXT in
-- classes.nrha_class_code and have no class_affiliations rows, so the
-- ReinerSuite export and the scribe sheet both fall back to that legacy
-- field. Linking them to the NRHA 2026 rule package's
-- association_class_codes gives:
--   - the association's own name for each code
--   - per-affiliation eligibility rules on the Issues tab
--   - counts_for_money / counts_for_points as data rather than assumption
--
-- Safe to re-run: the insert skips classes that already have an
-- affiliation for the same code.
--
-- RUN THE STEPS IN ORDER. Step 1 and 2 are read-only — read their output
-- before running step 3.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1 (read-only): what will match, and what will NOT.
-- Every row with matched_code_id = null is a class whose free-text code
-- has no counterpart in the NRHA 2026 package — those are the ones to
-- look at before inserting anything.
-- ------------------------------------------------------------
select
  s.name                as slate,
  c.class_number,
  c.name                as class_name,
  c.nrha_class_code     as free_text_code,
  acc.id                as matched_code_id,
  acc.name              as nrha_name
from public.classes c
join public.shows s on s.id = c.show_id
join public.show_weekends w on w.id = s.weekend_id
left join public.association_class_codes acc
       on acc.code = c.nrha_class_code
      and acc.rule_package_id = (
        select rp.id
        from public.association_rule_packages rp
        join public.associations a on a.id = rp.association_id
        where rp.organization_id = w.organization_id
          and upper(a.name) = 'NRHA'
        order by rp.created_at desc
        limit 1
      )
where w.name = 'EPRHA Fire Cracker Classic 2026'
order by s.start_date, c.class_number;

-- ------------------------------------------------------------
-- STEP 2 (read-only): the summary. Expect unmatched = 0 before
-- continuing. already_linked counts classes that already have any
-- affiliation row.
-- ------------------------------------------------------------
with pkg as (
  select rp.id
  from public.association_rule_packages rp
  join public.associations a on a.id = rp.association_id
  join public.show_weekends w on w.organization_id = rp.organization_id
  where w.name = 'EPRHA Fire Cracker Classic 2026'
    and upper(a.name) = 'NRHA'
  order by rp.created_at desc
  limit 1
)
select
  count(*)                                              as classes_total,
  count(*) filter (where c.nrha_class_code is null)     as no_code_at_all,
  count(*) filter (where acc.id is null
                     and c.nrha_class_code is not null) as unmatched,
  count(*) filter (where acc.id is not null)            as will_link,
  count(*) filter (where exists (
    select 1 from public.class_affiliations ca where ca.class_id = c.id
  ))                                                    as already_linked
from public.classes c
join public.shows s on s.id = c.show_id
join public.show_weekends w on w.id = s.weekend_id
left join public.association_class_codes acc
       on acc.code = c.nrha_class_code
      and acc.rule_package_id = (select id from pkg)
where w.name = 'EPRHA Fire Cracker Classic 2026';

-- ------------------------------------------------------------
-- STEP 3 (writes): create the affiliations.
--
-- counts_for_money / counts_for_points are taken from the code itself,
-- so the class inherits what the rule package says rather than a guess.
-- is_primary is true because these classes have no other affiliation —
-- it drives the legacy single-code reads and the export fallback.
-- ------------------------------------------------------------
with pkg as (
  select rp.id
  from public.association_rule_packages rp
  join public.associations a on a.id = rp.association_id
  join public.show_weekends w on w.organization_id = rp.organization_id
  where w.name = 'EPRHA Fire Cracker Classic 2026'
    and upper(a.name) = 'NRHA'
  order by rp.created_at desc
  limit 1
)
insert into public.class_affiliations (
  class_id, show_id, organization_id, association_class_code_id,
  counts_for_money, counts_for_points, counts_for_year_end, is_primary
)
select
  c.id, c.show_id, c.organization_id, acc.id,
  acc.counts_for_money, acc.counts_for_points, false, true
from public.classes c
join public.shows s on s.id = c.show_id
join public.show_weekends w on w.id = s.weekend_id
join public.association_class_codes acc
  on acc.code = c.nrha_class_code
 and acc.rule_package_id = (select id from pkg)
where w.name = 'EPRHA Fire Cracker Classic 2026'
  and c.nrha_class_code is not null
on conflict (class_id, association_class_code_id) do nothing;

-- ------------------------------------------------------------
-- STEP 4 (read-only): verify. Every class should now show its linked
-- code, and linked_count should equal will_link from step 2.
-- ------------------------------------------------------------
select
  s.name            as slate,
  c.class_number,
  c.name            as class_name,
  acc.code          as linked_code,
  acc.name          as linked_name
from public.classes c
join public.shows s on s.id = c.show_id
join public.show_weekends w on w.id = s.weekend_id
left join public.class_affiliations ca on ca.class_id = c.id
left join public.association_class_codes acc on acc.id = ca.association_class_code_id
where w.name = 'EPRHA Fire Cracker Classic 2026'
order by s.start_date, c.class_number;
