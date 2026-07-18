-- ------------------------------------------------------------
-- 00056: edit a misc charge's quantity as well as its price.
--
-- update_misc_charge_amount (00042) rewrites amount_cents only. Once a
-- charge carries quantity and a unit price (00054), that is not enough:
-- correcting "8 bags of shavings" to 6 means recomputing the total AND
-- keeping the line's own arithmetic honest, otherwise the bill shows
-- 8 x $9.50 next to a total that is not 8 x $9.50.
--
-- This sets unit, quantity and total together, so the line always
-- explains itself. The total is computed here rather than trusted from
-- the caller.
--
-- $0 is allowed: comping a line while keeping it on the bill is an
-- existing, deliberate behaviour (the camper case from 00042).
-- ------------------------------------------------------------

create or replace function public.update_misc_charge_line(
  p_charge uuid,
  p_unit_amount_cents integer,
  p_quantity integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge record;
  v_qty integer;
  v_total integer;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to change a charge';
  end if;

  select * into v_charge from public.misc_charges where id = p_charge;
  if v_charge is null then
    raise exception 'Charge not found';
  end if;

  if not public.has_org_permission(v_charge.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  v_qty := coalesce(p_quantity, 1);
  if v_qty <= 0 then
    raise exception 'Quantity must be at least 1';
  end if;
  if v_qty > 999 then
    raise exception 'Quantity must be 999 or fewer';
  end if;

  if p_unit_amount_cents is null or p_unit_amount_cents < 0 then
    raise exception 'Price cannot be negative';
  end if;

  v_total := p_unit_amount_cents * v_qty;

  update public.misc_charges
  set amount_cents = v_total,
      quantity = v_qty,
      unit_amount_cents = p_unit_amount_cents
  where id = p_charge;

  perform public.log_audit(
    v_charge.organization_id, 'misc_charge.updated', 'misc_charge', p_charge::text,
    jsonb_build_object('amount_cents', v_charge.amount_cents,
                       'quantity', v_charge.quantity,
                       'unit_amount_cents', v_charge.unit_amount_cents),
    jsonb_build_object('amount_cents', v_total,
                       'quantity', v_qty,
                       'unit_amount_cents', p_unit_amount_cents),
    p_reason, v_charge.show_id);
end;
$$;

revoke execute on function public.update_misc_charge_line(uuid, integer, integer, text) from anon;
grant execute on function public.update_misc_charge_line(uuid, integer, integer, text) to authenticated;
