-- ============================================================
-- ShowRing IQ — Payee (party to receive winning checks)
--
-- The real EPRHA paper entry form captures TWO separate parties:
-- "party responsible for bill" (owner/exhibitor/other — already
-- modeled via owner/rider + bill_to_trainer) and "party to receive
-- winning checks" (owner/exhibitor/other, W-9 required). Until now
-- the payee was implicit: owner of record, falling back to rider
-- (src/lib/tax-report.ts). This adds an explicit per-entry payee.
--
-- NULL keeps today's default (owner → rider), so every existing
-- entry is unchanged. payee_name is a display snapshot alongside the
-- FK, same convention as rider_name/owner_name/trainer_name.
-- W-9 presence stays a live query against documents
-- (document_type='w9', status='verified') per 00039 — no stored
-- flag that can drift.
-- ============================================================

alter table public.entries
  add column payee_person_id uuid references public.people(id) on delete set null,
  add column payee_name text;

comment on column public.entries.payee_person_id is
  'Party to receive winning checks for this entry. NULL = default '
  '(owner of record, falling back to rider). Payee needs a verified '
  'W-9 document before checks are written.';

create index entries_payee_person_id_idx
  on public.entries (payee_person_id)
  where payee_person_id is not null;

-- Column-level grants (same pattern as 00035's bill_to_trainer):
-- row access is still gated by the entries RLS policies
-- (entry.create / entry.edit + show_is_editable).
grant insert (payee_person_id, payee_name) on public.entries to authenticated;
grant update (payee_person_id, payee_name) on public.entries to authenticated;
