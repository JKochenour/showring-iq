-- 00031: NRHA event classification (Show Rules G(10))
--
-- 1. shows.event_classification: the classification the show declares
--    (D/C/B/BB/A/AA). The app compares it against the classification
--    implied by total added money and renders a staffing/compliance
--    checklist — declaring is the manager's call, we only warn.
-- 2. show_staff.staff_role: add 'videographer' (official videographer is
--    strongly recommended at BB events and required at A/AA events).

alter table public.shows
  add column event_classification text
    check (event_classification in ('D', 'C', 'B', 'BB', 'A', 'AA'));

comment on column public.shows.event_classification is
  'Declared NRHA event classification (Show Rules G(10)). Null = not declared. '
  'Validation compares this against total added money; it never blocks.';

grant update (event_classification) on public.shows to authenticated;

alter table public.show_staff
  drop constraint show_staff_staff_role_check;

alter table public.show_staff
  add constraint show_staff_staff_role_check check (staff_role in (
    'manager', 'secretary', 'assistant_secretary', 'judge', 'scribe', 'gate',
    'announcer', 'treasurer', 'score_verifier', 'show_representative',
    'steward', 'videographer', 'veterinarian', 'farrier', 'photographer',
    'other'
  ));
