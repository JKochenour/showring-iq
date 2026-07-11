-- ============================================================
-- ShowRing IQ — Show billing: misc charges
-- Per-show, per-person itemized billing. Entry fees are NOT
-- duplicated here — they already live on entry_classes.fee_cents
-- and are read live, same source of truth the rest of the app uses.
-- This table only holds the manual, ad hoc items an office adds on
-- top of entry fees: ice, stabling, sponsorships, apparel, etc.
--
-- Billing party per entry is coalesce(owner_person_id, rider_person_id)
-- — an owner who isn't riding gets the bill; otherwise it falls to the
-- rider. Computed at query time in application code, not stored.
--
-- Scope is charges only (no payment recording yet) per product
-- decision — reuses the invoice.view/invoice.edit permissions already
-- defined in 00001_foundation.sql (Treasurer has edit, Show Manager
-- view-only), so no new permissions or role grants are needed.
-- ============================================================

create table public.misc_charges (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  description text not null check (char_length(description) between 1 and 200),
  category text not null default 'Other' check (char_length(category) between 1 and 60),
  amount_cents integer not null check (amount_cents > 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index misc_charges_show_person_idx on public.misc_charges (show_id, person_id);

alter table public.misc_charges enable row level security;

create policy "misc_charges_select_permitted" on public.misc_charges
  for select to authenticated
  using (public.has_org_permission(organization_id, 'invoice.view'));

-- Reads only; every write happens through the RPCs below so every
-- add/remove is audit-logged with a reason.
revoke insert, update, delete on public.misc_charges from authenticated;

-- ------------------------------------------------------------
-- RPC: add a misc charge to a person's bill for a show
-- ------------------------------------------------------------

create or replace function public.add_misc_charge(
  p_show uuid,
  p_person uuid,
  p_description text,
  p_category text,
  p_amount_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_person_org uuid;
  v_charge_id uuid;
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

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'A description is required';
  end if;

  insert into public.misc_charges (
    show_id, organization_id, person_id, description, category, amount_cents, created_by
  )
  values (
    p_show, v_show.organization_id, p_person, btrim(p_description),
    coalesce(nullif(btrim(p_category), ''), 'Other'), p_amount_cents, (select auth.uid())
  )
  returning id into v_charge_id;

  perform public.log_audit(v_show.organization_id, 'misc_charge.added', 'misc_charge', v_charge_id::text,
    null,
    jsonb_build_object('person_id', p_person, 'description', btrim(p_description),
                       'category', coalesce(nullif(btrim(p_category), ''), 'Other'),
                       'amount_cents', p_amount_cents),
    null, p_show);

  return v_charge_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: remove a misc charge (requires a reason, like every other
-- money-affecting correction in this app)
-- ------------------------------------------------------------

create or replace function public.remove_misc_charge(p_charge uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge record;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to remove a charge';
  end if;

  select * into v_charge from public.misc_charges where id = p_charge;
  if v_charge is null then
    raise exception 'Charge not found';
  end if;
  if not public.has_org_permission(v_charge.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  delete from public.misc_charges where id = p_charge;

  perform public.log_audit(v_charge.organization_id, 'misc_charge.removed', 'misc_charge', p_charge::text,
    jsonb_build_object('person_id', v_charge.person_id, 'description', v_charge.description,
                       'category', v_charge.category, 'amount_cents', v_charge.amount_cents),
    null, p_reason, v_charge.show_id);
end;
$$;

revoke execute on function public.add_misc_charge(uuid, uuid, text, text, integer) from anon;
revoke execute on function public.remove_misc_charge(uuid, text) from anon;
