-- ============================================================
-- NRHA 2026 eligibility rules, transcribed from the organization's own
-- copy of the NRHA Handbook (Documents/NRHA/2024-handbook.pdf).
--
-- HOW THE ENGINE READS THESE (src/lib/rule-package-engine.ts):
--   conditions describe the state a COMPLIANT entry is in. All
--   conditions must hold; if any fails, the rule raises its message.
--   A missing value (e.g. no birthdate) fails a numeric comparison, so
--   these also surface "we cannot check this" — which is why they are
--   warnings, not blocks.
--
-- WHY EVERYTHING IS A WARNING, NOT BLOCKING:
--   1. Ages are "as of January 1 of the current year"; the engine
--      compares a birthdate to today. Around a birthday the two differ.
--   2. NRHA ownership allows the Non Pro / youth OR immediate family OR
--      a family-owned entity. The engine cannot see family relationships,
--      so it can only check that an owner is recorded at all.
--   Blocking a legitimate entry at a show is worse than a warning the
--   office can clear. Same call AQHA SHW220 and APHA AM-020.A took.
--
-- DELIBERATELY NOT ENCODED (do not approximate these):
--   - Non Pro card status, the $200,000 Open-earnings ceiling, and the
--     prohibited-activities test (Non Pro Membership Conditions B.1).
--   - Rookie / Limited / Intermediate / Level and Novice Horse earnings
--     caps. These need lifetime-earnings data the app does not hold.
--   - Immediate-family ownership.
--   - Snaffle Bit / Hackamore horse-age limits.
--   - Prime Time ROOKIE (5301): the handbook text extracted here never
--     states its age, and the other Prime Time classes' "50 and older"
--     must not simply be assumed onto it. Left out on purpose.
--
-- OWNERSHIP EXEMPTIONS ARE HONOURED: the handbook states there are no
-- ownership restrictions in Category 10 (Green Reiner, Ride & Slide),
-- Rookie (L1, L2, Prime Time Rookie, Youth Rookie) and Unrestricted
-- Youth. The ownership rules below therefore list non-pro codes
-- EXPLICITLY rather than using the "non_pro" category, which would
-- wrongly catch Ride & Slide Non Pro.
--
-- Safe to re-run: on conflict (rule_package_id, rule_key) do nothing.
-- ============================================================

with pkg as (
  select rp.id, rp.organization_id
  from public.association_rule_packages rp
  join public.associations a on a.id = rp.association_id
  where upper(a.name) = 'NRHA'
    and rp.organization_id = (
      select organization_id from public.show_weekends
      where name = 'EPRHA Fire Cracker Classic 2026' limit 1
    )
  order by rp.created_at desc
  limit 1
)
insert into public.association_eligibility_rules
  (rule_package_id, organization_id, rule_key, applies_to, conditions, severity, message)
select pkg.id, pkg.organization_id, v.rule_key, v.applies_to, v.conditions::jsonb, v.severity, v.message
from pkg,
(values
  -- Youth 13 & Under: "For youth 13 & under as of January 1 of the
  -- current year." Includes the aged-event variant.
  ('nrha_youth_13_under',
   array['3100','2720'],
   '[{"field":"rider.age","operator":"less_than","value":"14"}]',
   'warning',
   'Youth 13 & Under: rider must be 13 or under as of January 1 (NRHA Handbook, youth class conditions). Check the rider''s birthdate is on file and correct.'),

  -- Youth 14-18: "For youth 14-18 as of January 1 of the current year."
  ('nrha_youth_14_18',
   array['3200','2730'],
   '[{"field":"rider.age","operator":"greater_than","value":"13"},{"field":"rider.age","operator":"less_than","value":"19"}]',
   'warning',
   'Youth 14-18: rider must be 14 to 18 as of January 1 (NRHA Handbook, youth class conditions). Check the rider''s birthdate is on file and correct.'),

  -- Prime Time Open / Non Pro (and their aged-event variants):
  -- "For persons 50 and older as of January 1 of the current year."
  ('nrha_prime_time_50',
   array['1110','1650','2350','2650'],
   '[{"field":"rider.age","operator":"greater_than","value":"49"}]',
   'warning',
   'Prime Time: rider must be 50 or older as of January 1 (NRHA Handbook, Prime Time class conditions). Check the rider''s birthdate is on file and correct.'),

  -- Masters Non Pro: "For persons 60 and older as of January 1 of the
  -- current year."
  ('nrha_masters_60',
   array['1660','2621'],
   '[{"field":"rider.age","operator":"greater_than","value":"59"}]',
   'warning',
   'Masters Non Pro: rider must be 60 or older as of January 1 (NRHA Handbook, Masters class conditions). Check the rider''s birthdate is on file and correct.'),

  -- Legends Non Pro: "For Persons 70 and older as of January 1 of the
  -- current year."
  ('nrha_legends_70',
   array['5270'],
   '[{"field":"rider.age","operator":"greater_than","value":"69"}]',
   'warning',
   'Legends Non Pro: rider must be 70 or older as of January 1 (NRHA Handbook, Legends class conditions). Check the rider''s birthdate is on file and correct.'),

  -- Non Pro ownership: the horse must be "solely and completely owned
  -- by (1) the Non Pro (2) member(s) of the Non Pro's immediate family
  -- (3) a corporation/partnership solely owned by them". The engine can
  -- only confirm an owner is recorded; the family test is manual.
  -- Codes listed explicitly to keep Ride & Slide Non Pro (no ownership
  -- restriction) out of it.
  ('nrha_non_pro_ownership_recorded',
   array['1400','1500','1600','1650','1660','1800','1850','1875','2400','2500','2600','2621','2625','2650','2700','2940','2950','2960','4690','5270','111400'],
   '[{"field":"entry.hasOwner","operator":"equals","value":"true"}]',
   'warning',
   'Non Pro: record the horse''s owner. NRHA requires the horse to be owned solely by the Non Pro, their immediate family, or a business entity they solely own — verify the relationship against the current NRHA Handbook.'),

  -- Youth ownership: "All horses shown in the Youth 13 & Under and
  -- Youth 14-18 classes must be solely and completely owned by (a) the
  -- youth, (b) a member of his or her immediate family, or (c) a
  -- business entity solely owned by them." Youth Rookie (3300) and
  -- Unrestricted Youth (3400) are exempt and are not listed.
  ('nrha_youth_ownership_recorded',
   array['3100','3200','2720','2730'],
   '[{"field":"entry.hasOwner","operator":"equals","value":"true"}]',
   'warning',
   'Youth class: record the horse''s owner. NRHA requires the horse to be owned solely by the youth, their immediate family, or a business entity they solely own — verify the relationship against the current NRHA Handbook.')
) as v(rule_key, applies_to, conditions, severity, message)
on conflict (rule_package_id, rule_key) do nothing;

-- Verify: expect 7 rows.
select rule_key, severity, applies_to, conditions
from public.association_eligibility_rules
where rule_package_id = (
  select rp.id
  from public.association_rule_packages rp
  join public.associations a on a.id = rp.association_id
  where upper(a.name) = 'NRHA'
  order by rp.created_at desc
  limit 1
)
order by rule_key;
