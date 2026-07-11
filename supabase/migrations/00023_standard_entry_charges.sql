-- ============================================================
-- ShowRing IQ — Standard per-entry charges
-- Lets a show define a fixed set of charges (e.g. a stall fee, an
-- office fee, a drug/medication fee) that automatically land on a
-- person's bill the first time each of their back numbers is
-- assigned — no manual misc-charge entry needed for the common case.
-- Generic per-show config, not hard-coded to any association: the
-- default empty list means nothing changes for shows that don't use
-- it. Office staff can still remove an auto-applied charge from an
-- individual bill afterward, same as any other misc charge.
-- ============================================================

alter table public.shows
  add column standard_entry_charges jsonb not null default '[]'::jsonb;

grant update (standard_entry_charges) on public.shows to authenticated;

create or replace function public.assign_back_number(
  p_entry uuid,
  p_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_num integer;
  v_existing record;
  v_charges jsonb;
  v_charge jsonb;
  v_billed_person uuid;
  v_label text;
  v_amount integer;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.assign_back_number') then
    raise exception 'Missing permission: entry.assign_back_number';
  end if;

  if p_number is null then
    select coalesce(max(number), 0) + 1 into v_num
    from public.back_numbers where show_id = v_entry.show_id;
  else
    v_num := p_number;
  end if;

  select * into v_existing from public.back_numbers where entry_id = p_entry;

  if v_existing is not null then
    if v_existing.number = v_num then
      return v_num;
    end if;
    update public.back_numbers set number = v_num where entry_id = p_entry;
    perform public.log_audit(v_entry.organization_id, 'back_number.transferred', 'back_number', v_existing.id::text,
      jsonb_build_object('entry_id', p_entry, 'number', v_existing.number),
      jsonb_build_object('entry_id', p_entry, 'number', v_num));
  else
    insert into public.back_numbers (show_id, organization_id, number, entry_id)
    values (v_entry.show_id, v_entry.organization_id, v_num, p_entry);
    perform public.log_audit(v_entry.organization_id, 'back_number.assigned', 'back_number', null,
      null, jsonb_build_object('entry_id', p_entry, 'number', v_num));

    -- Apply this show's standard per-entry charges (e.g. stall, office,
    -- drug fee) once, now that this entry has a back number. A person
    -- with multiple entries/back numbers gets the charge once per entry
    -- — each horse needs its own stall, paperwork, etc.
    select standard_entry_charges into v_charges from public.shows where id = v_entry.show_id;
    v_billed_person := coalesce(v_entry.owner_person_id, v_entry.rider_person_id);

    for v_charge in select * from jsonb_array_elements(coalesce(v_charges, '[]'::jsonb))
    loop
      v_label := nullif(btrim(v_charge->>'label'), '');
      v_amount := nullif(v_charge->>'amount_cents', '')::integer;
      if v_label is not null and v_amount is not null and v_amount > 0 then
        insert into public.misc_charges (
          show_id, organization_id, person_id, description, category, amount_cents, created_by
        )
        values (
          v_entry.show_id, v_entry.organization_id, v_billed_person, v_label, v_label, v_amount, (select auth.uid())
        );

        perform public.log_audit(v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
          null,
          jsonb_build_object('person_id', v_billed_person, 'description', v_label,
                             'category', v_label, 'amount_cents', v_amount, 'source', 'standard_entry_charge'),
          null, v_entry.show_id);
      end if;
    end loop;
  end if;

  return v_num;
end;
$$;

revoke execute on function public.assign_back_number(uuid, integer) from anon;
