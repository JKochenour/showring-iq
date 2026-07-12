-- ============================================================
-- ShowRing IQ — Pattern picker + scribe staff role
-- The 20 official NRHA patterns (1-18, A, B) are fixed association
-- reference material, not an org-configurable rule, so their text
-- lives in src/lib/nrha-patterns.ts rather than a database table.
-- This migration only adds the two small pieces of schema needed:
--
-- 1. class_patterns.pattern_key: records which official pattern (if
--    any) a class's pattern_text was built from, so the printable
--    scribe score sheet can render per-maneuver columns without
--    re-parsing freeform text. Nullable/freely overridable — offices
--    can still type or paste a fully custom/modified pattern (NRHA
--    Green, Ride & Slide, Category 11/13 modified-pattern approval)
--    without picking from the library.
--
-- 2. show_staff.staff_role: add 'scribe' alongside the existing
--    judge/gate/announcer/etc. labels. A scribe is the person who
--    hand-writes the judge's called scores on the paper NRHA score
--    sheet during a run — per Handbook Judges' Guide, "management's
--    responsibility to supply a scribe at every official NRHA
--    event." No new permission role is needed (matches steward/vet/
--    farrier/photographer: a free-text staff label, not a login
--    permission preset).
-- ============================================================

alter table public.class_patterns
  add column pattern_key text
    check (pattern_key is null or pattern_key in (
      '1','2','3','4','5','6','7','8','9','10',
      '11','12','13','14','15','16','17','18','A','B'
    ));

alter table public.show_staff
  drop constraint show_staff_staff_role_check;

alter table public.show_staff
  add constraint show_staff_staff_role_check check (staff_role in (
    'manager', 'secretary', 'assistant_secretary', 'judge', 'scribe', 'gate',
    'announcer', 'treasurer', 'score_verifier', 'show_representative',
    'steward', 'veterinarian', 'farrier', 'photographer', 'other'
  ));
