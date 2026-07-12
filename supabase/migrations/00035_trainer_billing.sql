-- ============================================================
-- ShowRing IQ — Trainer/barn billing (responsible party)
--
-- Real show offices bill the BARN, not the individual rider: a trainer
-- brings several clients, gets one bill, writes one check. Today every
-- bill is owner-or-rider (src/lib/billing.ts billedPersonId). This adds
-- an explicit opt-in per entry: bill_to_trainer. When set, the entry's
-- existing trainer_person_id becomes the billed party instead of
-- owner/rider — no new person-picker needed, entries already capture a
-- trainer. Billing/statement/reconciliation code groups by billed
-- person, so multiple clients' entries collapse onto one trainer bill
-- automatically once this is set.
-- ============================================================

alter table public.entries
  add column bill_to_trainer boolean not null default false;

alter table public.entries
  add constraint entries_bill_to_trainer_requires_trainer check (
    bill_to_trainer = false or trainer_person_id is not null
  );

comment on column public.entries.bill_to_trainer is
  'When true, this entry bills to trainer_person_id instead of '
  'owner_person_id/rider_person_id. Requires a trainer to be set.';

grant update (bill_to_trainer) on public.entries to authenticated;
