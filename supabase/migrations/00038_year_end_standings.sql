-- ============================================================
-- ShowRing IQ — Year-end / high-point standings, data side
--
-- The cross-show aggregation itself is computed in application code
-- (src/lib/standings.ts) from data that already exists — results,
-- class_affiliations.counts_for_year_end (added in 00018, currently
-- unused by any feature), and entries. The only new schema is a
-- points-per-placing schedule, since (per CLAUDE.md principle #2)
-- award point values are association/org policy, not something this
-- app hard-codes. Same disclaimed-starting-point pattern as
-- EXAMPLE_PAYOUT_SCHEDULE — no default point values are assumed.
-- ============================================================

alter table public.association_rule_packages
  add column points_schedule jsonb not null default '[]'::jsonb;

comment on column public.association_rule_packages.points_schedule is
  'Array of {"placing": 1, "points": 10} objects used to convert a '
  'result''s placing into high-point-standings points for this rule '
  'package''s season. Org-configured — not an official association '
  'formula unless the org enters one. Empty = points always compute to 0.';
