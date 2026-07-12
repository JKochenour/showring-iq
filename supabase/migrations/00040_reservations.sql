-- ============================================================
-- ShowRing IQ — Stall/camper/warm-up reservations
--
-- From the Fire Cracker bill: "Stall: $185 // $20 off stall fees for
-- youth shown horses! Camper: $165... Paid Warmups (Wednesday) Contact:
-- Jennifer Geedy" — today this is an off-platform Google-form-and-email
-- workflow. One generic reservations table covers all three (and
-- anything else a show wants to offer): a request/confirm flow where
-- confirming creates a misc_charge, so a reservation flows straight
-- into the existing billing ledger.
--
-- The reservation TYPES themselves (label, unit price, optional slot
-- choices for something like Wednesday warm-ups) are show-configured
-- data (shows.reservation_types), not hard-coded — same pattern as
-- standard_entry_charges (00023).
-- ============================================================

alter table public.shows
  add column reservation_types jsonb not null default '[]'::jsonb;

comment on column public.shows.reservation_types is
  'Array of {"key","label","unitPriceCents","slotOptions":[...]}. '
  'slotOptions non-empty means the reservation needs a chosen slot '
  '(e.g. Wednesday AM/PM warm-up); empty means a plain quantity item '
  '(e.g. Stall, Camper). Empty array = this show does not take '
  'reservations through the app.';

grant update (reservation_types) on public.shows to authenticated;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  type_key text not null,
  label text not null,
  quantity integer not null default 1 check (quantity between 1 and 100),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  slot_label text,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  charge_id uuid references public.misc_charges (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reservations is
  'Stall/camper/warm-up (or any other show-defined) reservations. '
  'Confirming one inserts a misc_charge for quantity * unit_price_cents '
  'and links it via charge_id.';

create index reservations_show_person_idx on public.reservations (show_id, person_id);

alter table public.reservations enable row level security;

create policy "reservations_select_permitted" on public.reservations
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

revoke insert, update, delete on public.reservations from authenticated;

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RPC: request a reservation. Snapshots price/label from the show's
-- current reservation_types config at request time, so a later config
-- change doesn't retroactively alter an existing request.
-- ------------------------------------------------------------

create or replace function public.request_reservation(
  p_show uuid,
  p_person uuid,
  p_type_key text,
  p_quantity integer default 1,
  p_slot_label text default null,
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
  v_types jsonb;
  v_type jsonb;
  v_reservation_id uuid;
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

  select value into v_type
  from jsonb_array_elements(coalesce(v_show.reservation_types, '[]'::jsonb))
  where value->>'key' = p_type_key;

  if v_type is null then
    raise exception 'Unknown reservation type: %', p_type_key;
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  insert into public.reservations (
    show_id, organization_id, person_id, type_key, label,
    quantity, unit_price_cents, slot_label, notes, created_by
  )
  values (
    p_show, v_show.organization_id, p_person, p_type_key,
    coalesce(v_type->>'label', p_type_key),
    p_quantity, coalesce((v_type->>'unitPriceCents')::integer, 0),
    nullif(btrim(coalesce(p_slot_label, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    (select auth.uid())
  )
  returning id into v_reservation_id;

  perform public.log_audit(v_show.organization_id, 'reservation.requested', 'reservation', v_reservation_id::text,
    null,
    jsonb_build_object('person_id', p_person, 'type_key', p_type_key, 'quantity', p_quantity),
    null, p_show);

  return v_reservation_id;
end;
$$;

revoke execute on function public.request_reservation(uuid, uuid, text, integer, text, text) from anon;

-- ------------------------------------------------------------
-- RPC: confirm a reservation, creating its misc_charge.
-- ------------------------------------------------------------

create or replace function public.confirm_reservation(p_reservation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res record;
  v_charge_id uuid;
  v_total integer;
begin
  select * into v_res from public.reservations where id = p_reservation;
  if v_res is null then
    raise exception 'Reservation not found';
  end if;
  if not public.has_org_permission(v_res.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;
  if v_res.status <> 'requested' then
    raise exception 'Only a requested reservation can be confirmed';
  end if;

  v_total := v_res.quantity * v_res.unit_price_cents;

  if v_total > 0 then
    insert into public.misc_charges (
      show_id, organization_id, person_id, description, category, amount_cents, created_by
    )
    values (
      v_res.show_id, v_res.organization_id, v_res.person_id,
      case when v_res.quantity > 1 then format('%s (x%s)', v_res.label, v_res.quantity) else v_res.label end,
      v_res.label, v_total, (select auth.uid())
    )
    returning id into v_charge_id;
  end if;

  update public.reservations
  set status = 'confirmed', charge_id = v_charge_id
  where id = p_reservation;

  perform public.log_audit(v_res.organization_id, 'reservation.confirmed', 'reservation', p_reservation::text,
    null, jsonb_build_object('charge_id', v_charge_id, 'total_cents', v_total),
    null, v_res.show_id);
end;
$$;

revoke execute on function public.confirm_reservation(uuid) from anon;

-- ------------------------------------------------------------
-- RPC: cancel a reservation. If it was already confirmed (and
-- charged), the charge is left in place for the office to remove
-- separately via the ordinary misc-charge removal flow — cancelling a
-- reservation is not an implicit refund.
-- ------------------------------------------------------------

create or replace function public.cancel_reservation(p_reservation uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res record;
begin
  select * into v_res from public.reservations where id = p_reservation;
  if v_res is null then
    raise exception 'Reservation not found';
  end if;
  if not public.has_org_permission(v_res.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;
  if v_res.status = 'cancelled' then
    return;
  end if;

  update public.reservations set status = 'cancelled' where id = p_reservation;

  perform public.log_audit(v_res.organization_id, 'reservation.cancelled', 'reservation', p_reservation::text,
    jsonb_build_object('status', v_res.status), jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    p_reason, v_res.show_id);
end;
$$;

revoke execute on function public.cancel_reservation(uuid, text) from anon;
