-- ============================================================
-- ShowRing IQ — Charge attribution + youth office fee as a $0 line
--
-- Two changes, both driven by EPRHA's real live statement:
--
-- 1. misc_charges.entry_id — attribute an auto-applied office/stall/drug
--    charge to the horse (entry) it was applied for, so the printable
--    statement can itemize charges under each Back # like the real bill.
--    Nullable: legacy rows and manual charges (e.g. a camper) stay null
--    and show as person-level "other" charges.
--
-- 2. Youth office fee becomes a kept $0 line, not an omission. The real
--    bill charges stall + drug to a youth-only horse but shows
--    "Office Fee - youth entry only  $0.00". So instead of skipping ALL
--    standard charges for a youth-only entry, we now apply them, and a
--    charge flagged youth_exempt is inserted at $0 with a "- youth entry
--    only" label (the line stays for the count). Non-exempt charges
--    (stall, drug) are charged in full. youth_exempt is a per-charge flag
--    in the standard_entry_charges jsonb; existing office-labeled charges
--    are backfilled to youth_exempt = true to preserve "youth pays no
--    office fee."
-- ============================================================

-- ------------------------------------------------------------
-- 1. Attribute charges to a horse (entry). on delete set null so removing
--    an entry doesn't cascade-delete its already-billed charges history.
-- ------------------------------------------------------------

alter table public.misc_charges
  add column entry_id uuid references public.entries (id) on delete set null;

create index misc_charges_entry_idx on public.misc_charges (entry_id)
  where entry_id is not null;

comment on column public.misc_charges.entry_id is
  'The entry (horse) this charge was applied for, when known — set by '
  'assign_back_number for office/stall/drug so statements group them under '
  'the right Back #. Null for manual/person-level charges.';

-- ------------------------------------------------------------
-- 2. Backfill youth_exempt = true on existing office-labeled standard
--    charges so youth-only horses keep paying no office fee.
-- ------------------------------------------------------------

update public.shows s
set standard_entry_charges = (
  select jsonb_agg(
    case
      when lower(coalesce(elem->>'label', '')) like '%office%'
        then elem || jsonb_build_object('youth_exempt', true)
      else elem
    end
  )
  from jsonb_array_elements(s.standard_entry_charges) elem
)
where s.standard_entry_charges is not null
  and jsonb_array_length(s.standard_entry_charges) > 0;

-- ------------------------------------------------------------
-- 3. assign_back_number: apply standard charges for youth-only entries too,
--    zeroing youth_exempt ones (kept $0 line), and record entry_id on every
--    charge. Same signature — plain replace of the 00041 version.
-- ------------------------------------------------------------

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
  v_weekend_id uuid;
  v_wbn record;
  v_num integer;
  v_first_time boolean := false;
  v_proj record;
  v_charges jsonb;
  v_charge jsonb;
  v_billed_person uuid;
  v_label text;
  v_amount integer;
  v_all_youth boolean;
  v_youth_exempt boolean;
  v_desc text;
  v_final_amount integer;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.assign_back_number') then
    raise exception 'Missing permission: entry.assign_back_number';
  end if;

  select weekend_id into v_weekend_id from public.shows where id = v_entry.show_id;
  if v_weekend_id is null then
    raise exception 'Show has no weekend';
  end if;

  select * into v_wbn
  from public.weekend_back_numbers
  where weekend_id = v_weekend_id and horse_id = v_entry.horse_id;

  if p_number is not null then
    v_num := p_number;
    if exists (
      select 1 from public.weekend_back_numbers
      where weekend_id = v_weekend_id and number = v_num and horse_id <> v_entry.horse_id
    ) then
      raise exception 'Back number % is already used by another horse this weekend', v_num;
    end if;
  elsif v_wbn is not null then
    v_num := v_wbn.number;
  else
    select coalesce(max(number), 0) + 1 into v_num
    from public.weekend_back_numbers where weekend_id = v_weekend_id;
  end if;

  if v_wbn is null then
    v_first_time := true;
    insert into public.weekend_back_numbers (weekend_id, organization_id, horse_id, number)
    values (v_weekend_id, v_entry.organization_id, v_entry.horse_id, v_num);
    perform public.log_audit(v_entry.organization_id, 'back_number.assigned', 'weekend_back_number', null,
      null, jsonb_build_object('horse_id', v_entry.horse_id, 'weekend_id', v_weekend_id, 'number', v_num),
      null, v_entry.show_id);
  elsif v_wbn.number <> v_num then
    update public.weekend_back_numbers set number = v_num where id = v_wbn.id;
    update public.back_numbers bn
      set number = v_num
      from public.shows s
      where s.id = bn.show_id and s.weekend_id = v_weekend_id and bn.horse_id = v_entry.horse_id;
    perform public.log_audit(v_entry.organization_id, 'back_number.transferred', 'weekend_back_number', v_wbn.id::text,
      jsonb_build_object('horse_id', v_entry.horse_id, 'number', v_wbn.number),
      jsonb_build_object('horse_id', v_entry.horse_id, 'number', v_num),
      null, v_entry.show_id);
  end if;

  select * into v_proj from public.back_numbers where entry_id = p_entry;
  if v_proj is null then
    insert into public.back_numbers (show_id, organization_id, number, entry_id, horse_id)
    values (v_entry.show_id, v_entry.organization_id, v_num, p_entry, v_entry.horse_id);
  elsif v_proj.number <> v_num then
    update public.back_numbers set number = v_num where entry_id = p_entry;
  end if;

  -- Once-per-horse-per-weekend standard charges (office / stall / drug),
  -- only the first time the horse gets a number. Youth-only entries still
  -- get them, but any charge flagged youth_exempt is inserted at $0 with a
  -- "- youth entry only" label (kept for the count). Per-run charges are
  -- computed live per run in billing.ts (00042), not applied here.
  if v_first_time then
    select bool_and(c.is_youth) into v_all_youth
    from public.entry_classes ec
    join public.classes c on c.id = ec.class_id
    where ec.entry_id = p_entry and ec.status = 'entered';
    v_all_youth := coalesce(v_all_youth, false);

    select standard_entry_charges into v_charges from public.shows where id = v_entry.show_id;
    v_billed_person := case
      when v_entry.bill_to_trainer and v_entry.trainer_person_id is not null
        then v_entry.trainer_person_id
      else coalesce(v_entry.owner_person_id, v_entry.rider_person_id)
    end;

    for v_charge in
      select * from jsonb_array_elements(coalesce(v_charges, '[]'::jsonb))
      where (value->>'per_run')::boolean is not true
    loop
      v_label := nullif(btrim(v_charge->>'label'), '');
      v_amount := nullif(v_charge->>'amount_cents', '')::integer;
      v_youth_exempt := (v_charge->>'youth_exempt')::boolean is true;
      if v_label is not null and v_amount is not null and v_amount > 0 then
        if v_all_youth and v_youth_exempt then
          v_final_amount := 0;
          v_desc := v_label || ' - youth entry only';
        else
          v_final_amount := v_amount;
          v_desc := v_label;
        end if;
        insert into public.misc_charges (
          show_id, organization_id, person_id, entry_id, description, category, amount_cents, created_by
        )
        values (
          v_entry.show_id, v_entry.organization_id, v_billed_person, p_entry,
          v_desc, v_label, v_final_amount, (select auth.uid())
        );
        perform public.log_audit(v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
          null,
          jsonb_build_object('person_id', v_billed_person, 'description', v_desc,
                             'category', v_label, 'amount_cents', v_final_amount,
                             'source', 'weekend_horse_charge', 'horse_id', v_entry.horse_id,
                             'entry_id', p_entry),
          null, v_entry.show_id);
      end if;
    end loop;
  end if;

  return v_num;
end;
$$;

revoke execute on function public.assign_back_number(uuid, integer) from anon;
