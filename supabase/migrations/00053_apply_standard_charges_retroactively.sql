-- ------------------------------------------------------------
-- 00053: apply standard per-entry charges to horses that are ALREADY
-- entered.
--
-- Standard charges (office / stall / drug) are snapshotted by
-- assign_back_number at the moment a horse first receives a back number
-- for the weekend (00023 -> 00041 -> 00043). That means configuring, or
-- correcting, the charge list AFTER entries have been taken silently
-- misses every horse already holding a number — the office discovers it
-- when the bills come out short.
--
-- This RPC replays that same once-per-horse-per-weekend logic over the
-- horses already numbered, skipping any charge the horse (or its bill
-- payer) has already been billed for, so it is safe to run repeatedly
-- and safe to run after a partial configuration change.
--
-- Deliberately mirrors assign_back_number's semantics rather than
-- reimplementing them: same first-signer attribution, same
-- bill_to_trainer resolution, same youth_exempt $0 line, same audit
-- shape, and per_run charges excluded (billing.ts computes those live).
-- ------------------------------------------------------------

create or replace function public.apply_standard_charges_to_existing(
  p_show uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_show_ids uuid[];
  v_charges jsonb;
  v_horse record;
  v_entry record;
  v_charge jsonb;
  v_label text;
  v_amount integer;
  v_youth_exempt boolean;
  v_final_amount integer;
  v_desc text;
  v_billed uuid;
  v_all_youth boolean;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_horses integer := 0;
begin
  select id, organization_id, weekend_id, standard_entry_charges
    into v_show
  from public.shows
  where id = p_show;

  if v_show is null then
    raise exception 'Show not found';
  end if;

  if not public.has_org_permission(v_show.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  v_charges := coalesce(v_show.standard_entry_charges, '[]'::jsonb);
  if jsonb_array_length(v_charges) = 0 then
    return jsonb_build_object('inserted', 0, 'skipped', 0, 'horses', 0,
                              'note', 'no standard charges configured');
  end if;

  -- The charge is once per horse per WEEKEND, so idempotency and
  -- first-signer both have to be judged across every slate.
  if v_show.weekend_id is null then
    v_show_ids := array[p_show];
  else
    select array_agg(id) into v_show_ids
    from public.shows where weekend_id = v_show.weekend_id;
  end if;

  -- Every horse already carrying a number anywhere in the weekend.
  for v_horse in
    select distinct e.horse_id
    from public.back_numbers bn
    join public.entries e on e.id = bn.entry_id
    where bn.show_id = any(v_show_ids)
  loop
    v_horses := v_horses + 1;

    -- First signer: the earliest numbered entry for this horse in the
    -- weekend. That is who assign_back_number would have billed.
    select e.* into v_entry
    from public.back_numbers bn
    join public.entries e on e.id = bn.entry_id
    where bn.show_id = any(v_show_ids)
      and e.horse_id = v_horse.horse_id
    order by e.created_at asc, e.id asc
    limit 1;

    continue when v_entry is null;

    select bool_and(c.is_youth) into v_all_youth
    from public.entry_classes ec
    join public.classes c on c.id = ec.class_id
    where ec.entry_id = v_entry.id and ec.status = 'entered';
    v_all_youth := coalesce(v_all_youth, false);

    v_billed := case
      when v_entry.bill_to_trainer and v_entry.trainer_person_id is not null
        then v_entry.trainer_person_id
      else coalesce(v_entry.owner_person_id, v_entry.rider_person_id)
    end;

    for v_charge in
      select * from jsonb_array_elements(v_charges)
      where (value->>'per_run')::boolean is not true
    loop
      v_label := nullif(btrim(v_charge->>'label'), '');
      v_amount := nullif(v_charge->>'amount_cents', '')::integer;
      v_youth_exempt := (v_charge->>'youth_exempt')::boolean is true;

      if v_label is null or v_amount is null or v_amount <= 0 then
        continue;
      end if;

      -- Already billed? Two shapes count as already-billed:
      --   1. a charge attributed to any entry of this horse (what
      --      assign_back_number writes, and what a previous run wrote)
      --   2. an unattributed charge of the same category on the bill
      --      payer — a legacy row, or one the office keyed in by hand.
      -- Case 2 can skip a genuinely-owed charge when one person has two
      -- horses, which is the safe direction to err: under-charging is
      -- visible on the bill, double-charging an exhibitor is not.
      if exists (
        select 1
        from public.misc_charges mc
        join public.entries e2 on e2.id = mc.entry_id
        where mc.show_id = any(v_show_ids)
          and e2.horse_id = v_horse.horse_id
          and mc.category = v_label
      ) or exists (
        select 1
        from public.misc_charges mc
        where mc.show_id = any(v_show_ids)
          and mc.entry_id is null
          and mc.person_id = v_billed
          and mc.category = v_label
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if v_all_youth and v_youth_exempt then
        v_final_amount := 0;
        v_desc := v_label || ' - youth entry only';
      else
        v_final_amount := v_amount;
        v_desc := v_label;
      end if;

      insert into public.misc_charges (
        show_id, organization_id, person_id, entry_id,
        description, category, amount_cents, created_by
      )
      values (
        v_entry.show_id, v_entry.organization_id, v_billed, v_entry.id,
        v_desc, v_label, v_final_amount, (select auth.uid())
      );

      perform public.log_audit(
        v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
        null,
        jsonb_build_object('person_id', v_billed, 'description', v_desc,
                           'category', v_label, 'amount_cents', v_final_amount,
                           'source', 'standard_charge_backfill',
                           'horse_id', v_horse.horse_id,
                           'entry_id', v_entry.id),
        'Retroactive standard-charge apply', v_entry.show_id);

      v_inserted := v_inserted + 1;
    end loop;
  end loop;

  perform public.log_audit(
    v_show.organization_id, 'show.standard_charges_backfilled', 'show', p_show::text,
    null,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped,
                       'horses', v_horses),
    null, p_show);

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped,
                            'horses', v_horses);
end;
$$;

revoke execute on function public.apply_standard_charges_to_existing(uuid) from anon;
grant execute on function public.apply_standard_charges_to_existing(uuid) to authenticated;
