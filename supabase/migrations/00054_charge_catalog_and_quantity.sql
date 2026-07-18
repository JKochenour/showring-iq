-- ------------------------------------------------------------
-- 00054: a per-show price list for ad-hoc charges, and quantity on the
-- charge itself.
--
-- Shavings, ice, a non-shown horse's stall, a tack stall: the office
-- keys these in over and over, retyping the same price each time, and
-- hand-multiplying when someone takes eight bags of shavings. Two gaps:
--
--   1. shows.charge_catalog — the show's price list. Distinct from
--      standard_entry_charges (00023), which is applied AUTOMATICALLY to
--      every horse. Catalog items are never applied on their own; they
--      just pre-fill the add-charge form so the price is typed once, at
--      setup, instead of once per exhibitor.
--
--   2. misc_charges.quantity / unit_amount_cents — 8 x $9.50 recorded as
--      8 x $9.50, not as a bare $76.00. amount_cents remains the total
--      and stays the single source of truth for money, so every existing
--      sum keeps working untouched; the two new columns are how the line
--      explains itself on a bill and a statement.
--
-- Legacy rows get quantity 1 and a null unit price, which reads as a
-- plain one-off charge exactly as before.
-- ------------------------------------------------------------

alter table public.shows
  add column if not exists charge_catalog jsonb not null default '[]'::jsonb;

grant update (charge_catalog) on public.shows to authenticated;

alter table public.misc_charges
  add column if not exists quantity integer not null default 1,
  add column if not exists unit_amount_cents integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'misc_charges_quantity_positive'
  ) then
    alter table public.misc_charges
      add constraint misc_charges_quantity_positive check (quantity > 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'misc_charges_unit_amount_non_negative'
  ) then
    alter table public.misc_charges
      add constraint misc_charges_unit_amount_non_negative
      check (unit_amount_cents is null or unit_amount_cents >= 0);
  end if;
end $$;

-- ------------------------------------------------------------
-- add_misc_charge_qty: the quantity-aware add.
--
-- A separate function rather than a changed signature, so the existing
-- add_misc_charge (used by the close-out bulk apply, and by anything
-- that only ever adds one of something) keeps working unchanged.
--
-- The total is computed HERE from unit x quantity rather than trusted
-- from the client — money must not depend on the browser's arithmetic.
-- ------------------------------------------------------------
create or replace function public.add_misc_charge_qty(
  p_show uuid,
  p_person uuid,
  p_description text,
  p_category text,
  p_unit_amount_cents integer,
  p_quantity integer
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
  v_total integer;
  v_qty integer;
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

  if p_description is null or btrim(p_description) = '' then
    raise exception 'A description is required';
  end if;

  v_qty := coalesce(p_quantity, 1);
  if v_qty <= 0 then
    raise exception 'Quantity must be at least 1';
  end if;
  if v_qty > 999 then
    raise exception 'Quantity must be 999 or fewer';
  end if;

  if p_unit_amount_cents is null or p_unit_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_total := p_unit_amount_cents * v_qty;

  insert into public.misc_charges (
    show_id, organization_id, person_id, description, category,
    amount_cents, quantity, unit_amount_cents, created_by
  )
  values (
    p_show, v_show.organization_id, p_person, btrim(p_description),
    coalesce(nullif(btrim(p_category), ''), 'Other'),
    v_total, v_qty, p_unit_amount_cents, (select auth.uid())
  )
  returning id into v_charge_id;

  perform public.log_audit(
    v_show.organization_id, 'misc_charge.added', 'misc_charge', v_charge_id::text,
    null,
    jsonb_build_object('person_id', p_person, 'description', btrim(p_description),
                       'category', coalesce(nullif(btrim(p_category), ''), 'Other'),
                       'amount_cents', v_total,
                       'quantity', v_qty,
                       'unit_amount_cents', p_unit_amount_cents),
    null, p_show);

  return v_charge_id;
end;
$$;

revoke execute on function public.add_misc_charge_qty(uuid, uuid, text, text, integer, integer) from anon;
grant execute on function public.add_misc_charge_qty(uuid, uuid, text, text, integer, integer) to authenticated;
