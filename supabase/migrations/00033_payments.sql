-- ============================================================
-- ShowRing IQ — Payment recording (processor-agnostic ledger)
-- Completes the money loop started by 00022 (misc charges):
-- charges → payments → balance. The app RECORDS payments, it does
-- not process them — cards are swiped on the org's own terminal
-- (EPRHA uses Clover), checks and cash are taken at the office.
-- No processor integration, no API keys, works offline-at-the-desk.
--
-- Same conventions as misc_charges: tenant-scoped, reads gated on
-- invoice.view, every write through a security-definer RPC gated on
-- invoice.edit with a full audit-log entry, removal requires a
-- reason. Money as integer cents.
-- ============================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  method text not null check (method in ('cash', 'check', 'card', 'other')),
  amount_cents integer not null check (amount_cents > 0),
  reference text check (char_length(reference) <= 60),
  notes text check (char_length(notes) <= 200),
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

comment on table public.payments is
  'Payments received by the show office (cash/check/card-on-terminal). '
  'A ledger only — the platform never processes cards itself.';
comment on column public.payments.reference is
  'Check number, card-terminal receipt number, or similar free-text reference.';

create index payments_show_person_idx on public.payments (show_id, person_id);

alter table public.payments enable row level security;

create policy "payments_select_permitted" on public.payments
  for select to authenticated
  using (public.has_org_permission(organization_id, 'invoice.view'));

-- Reads only; every write happens through the RPCs below so every
-- record/removal is audit-logged.
revoke insert, update, delete on public.payments from authenticated;

-- ------------------------------------------------------------
-- RPC: record a payment against a person's bill for a show
-- ------------------------------------------------------------

create or replace function public.record_payment(
  p_show uuid,
  p_person uuid,
  p_method text,
  p_amount_cents integer,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_person_org uuid;
  v_payment_id uuid;
begin
  select * into v_show from public.shows where id = p_show;
  if v_show is null then
    raise exception 'Show not found';
  end if;
  if not public.has_org_permission(v_show.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  select organization_id into v_person_org from public.people where id = p_person;
  if v_person_org is null or v_person_org <> v_show.organization_id then
    raise exception 'Person not found in this organization';
  end if;

  if p_method is null or p_method not in ('cash', 'check', 'card', 'other') then
    raise exception 'Method must be cash, check, card, or other';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  insert into public.payments (
    show_id, organization_id, person_id, method, amount_cents,
    reference, notes, recorded_by
  )
  values (
    p_show, v_show.organization_id, p_person, p_method, p_amount_cents,
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    (select auth.uid())
  )
  returning id into v_payment_id;

  perform public.log_audit(v_show.organization_id, 'payment.recorded', 'payment', v_payment_id::text,
    null,
    jsonb_build_object('person_id', p_person, 'method', p_method,
                       'amount_cents', p_amount_cents,
                       'reference', nullif(btrim(coalesce(p_reference, '')), '')),
    null, p_show);

  return v_payment_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: remove a payment (requires a reason, like every other
-- money-affecting correction in this app)
-- ------------------------------------------------------------

create or replace function public.remove_payment(p_payment uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment record;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to remove a payment';
  end if;

  select * into v_payment from public.payments where id = p_payment;
  if v_payment is null then
    raise exception 'Payment not found';
  end if;
  if not public.has_org_permission(v_payment.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  delete from public.payments where id = p_payment;

  perform public.log_audit(v_payment.organization_id, 'payment.removed', 'payment', p_payment::text,
    jsonb_build_object('person_id', v_payment.person_id, 'method', v_payment.method,
                       'amount_cents', v_payment.amount_cents,
                       'reference', v_payment.reference),
    null, p_reason, v_payment.show_id);
end;
$$;

revoke execute on function public.record_payment(uuid, uuid, text, integer, text, text) from anon;
revoke execute on function public.remove_payment(uuid, text) from anon;
