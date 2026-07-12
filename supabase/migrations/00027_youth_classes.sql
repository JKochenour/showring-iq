-- ============================================================
-- ShowRing IQ — Youth class fee/retainage exemptions
-- Show Rules P(7): "When calculating youth money, the NRHA plaque
-- cost may not be deducted, and the NRHA five percent (5%) office
-- retainage fee is neither deducted nor paid to NRHA... No other
-- type of office fee may be charged to NRHA approved Youth classes."
--
-- Two distinct, unambiguous fixes:
-- 1. calculate_payouts treats a youth class's retainage as 0%
--    regardless of the configured classes.retainage_percent — the
--    payout pool for a youth class is never reduced by retainage.
-- 2. assign_back_number skips applying the show's standard per-entry
--    charges (stall/office/drug-style fees, see
--    00023_standard_entry_charges.sql) for an entry whose classes are
--    ALL youth classes. If the same back number also covers a
--    non-youth class, standard charges still apply as normal — the
--    exemption is for entries that are youth-only, which is the
--    clearest reading of "no office fee may be charged to Youth
--    classes." Office staff can still add a misc charge by hand for
--    any specific youth entry if a show's practice differs.
-- ============================================================

alter table public.classes
  add column is_youth boolean not null default false;

create or replace function public.calculate_payouts(p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
  v_pool_cents bigint;
  v_schedule jsonb;
  v_retainage numeric;
begin
  select * into v_class from public.classes where id = p_class;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  if not public.has_org_permission(v_class.organization_id, 'payout.calculate') then
    raise exception 'Missing permission: payout.calculate';
  end if;
  if v_class.status not in ('official', 'results_posted') then
    raise exception 'Class must be official before payouts can be calculated';
  end if;

  v_schedule := v_class.payout_schedule;
  if jsonb_array_length(coalesce(v_schedule, '[]'::jsonb)) = 0 then
    raise exception 'No payout schedule configured for this class';
  end if;

  select coalesce(sum(ec.fee_cents), 0) + v_class.added_money_cents into v_pool_cents
  from public.entry_classes ec
  where ec.class_id = p_class and ec.status = 'entered';

  v_retainage := case when v_class.is_youth then 0 else v_class.retainage_percent end;
  v_pool_cents := round(v_pool_cents * (1 - v_retainage / 100.0));

  -- Reset to zero first so placings no longer in the schedule/results clear out
  update public.results set money_won_cents = 0
  where class_id = p_class;

  -- Combined percent for each distinct placing value present in results,
  -- split evenly across every entry sharing that placing (tie split).
  with schedule_rows as (
    select (elem->>'placing')::int as "placing", (elem->>'percent')::numeric as percent
    from jsonb_array_elements(v_schedule) elem
  ),
  placing_totals as (
    select r."placing", count(*) as n_tied, sum(sr.percent) as percent_sum
    from public.results r
    join schedule_rows sr on sr."placing" = r."placing"
    where r.class_id = p_class and r."placing" is not null
    group by r."placing"
  )
  update public.results r
  set money_won_cents = round(v_pool_cents * pt.percent_sum / 100.0 / pt.n_tied)
  from placing_totals pt
  where r.class_id = p_class and r."placing" = pt."placing";

  perform public.log_audit(v_class.organization_id, 'payout.calculated', 'class', p_class::text,
    null, jsonb_build_object('pool_cents', v_pool_cents, 'retainage_percent', v_retainage));
end;
$$;

revoke execute on function public.calculate_payouts(uuid) from anon;

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
  v_all_youth boolean;
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

    select bool_and(c.is_youth) into v_all_youth
    from public.entry_classes ec
    join public.classes c on c.id = ec.class_id
    where ec.entry_id = p_entry and ec.status = 'entered';

    -- Apply this show's standard per-entry charges (e.g. stall, office,
    -- drug fee) once, now that this entry has a back number. A person
    -- with multiple entries/back numbers gets the charge once per entry
    -- — each horse needs its own stall, paperwork, etc. Skipped entirely
    -- when every class this entry is in is a youth class (Show Rules
    -- P(7): no office fee may be charged to Youth classes).
    if coalesce(v_all_youth, false) = false then
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
  end if;

  return v_num;
end;
$$;

revoke execute on function public.assign_back_number(uuid, integer) from anon;
