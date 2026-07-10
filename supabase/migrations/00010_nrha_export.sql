-- ============================================================
-- ShowRing IQ — Sprint 10: NRHA export v1
-- Minimal fields needed for the ReinerSuite CSV. A full rule-package
-- engine (multi-affiliation codes, versioned class code catalogs)
-- comes later — these are plain columns for the single-affiliation
-- MVP, not hard-coded NRHA business logic.
-- ============================================================

alter table public.shows
  add column nrha_show_number text;

alter table public.classes
  add column nrha_class_code text;

-- shows has column-level update grants (migration 00002); extend the
-- allowlist so nrha_show_number can be edited like any other field
grant update (nrha_show_number) on public.shows to authenticated;
