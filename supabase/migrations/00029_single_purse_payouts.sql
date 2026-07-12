-- ============================================================
-- ShowRing IQ — Single Purse tiered payout structure (aged shows)
-- Show Rules I(7): one class, one purse, one entry fee, riders of all
-- eligibility levels (1-4) compete together. Four payout tiers are
-- carved out of the paid placings; a rider's own level caps how deep
-- into the placings they're allowed to actually cash a check (level 4
-- = must place in the very top tier; level 1 = eligible anywhere).
--
-- The app has no career-earnings history, so it cannot derive a
-- rider's level automatically — office staff enter it per entry
-- (set_rider_level), the same "office declares it" pattern used
-- elsewhere (eligibility overrides, scratch reasons).
--
-- Section 1 (pay-spot count) and Section 2 (tier allocation, with the
-- Level-4->25% and Level-1-<25% exceptions) are implemented exactly
-- as written. The redistribution behavior when a placing has no
-- eligible rider is intentionally open in the Handbook itself ("show
-- management may contact NRHA for formulas to calculate payouts for
-- different sizes of events") — this implementation redistributes
-- proportionally among the placings that DO qualify, so the full pool
-- is always paid out. Level-champion award naming (Section 3(c)) is
-- ShowRing IQ's best-effort reading of ambiguous handbook text —
-- confirm against NRHA guidance before relying on it for awards.
-- ============================================================

alter table public.classes
  add column is_single_purse boolean not null default false;

alter table public.entry_classes
  add column rider_level smallint check (rider_level is null or rider_level between 1 and 4);

alter table public.results
  add column champion_level smallint check (champion_level is null or champion_level between 1 and 4);

-- ------------------------------------------------------------
-- set_rider_level: office declares a rider's eligibility level
-- (1-4) for a Single Purse class. Gated the same as payout math
-- (payout.calculate) since it exists purely to feed that calculation.
-- ------------------------------------------------------------

create or replace function public.set_rider_level(
  p_entry_class uuid,
  p_level integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select ec.*, c.class_number, c.name as class_name, c.is_single_purse
  into v_row
  from public.entry_classes ec
  join public.classes c on c.id = ec.class_id
  where ec.id = p_entry_class;

  if v_row is null then
    raise exception 'Entry class not found';
  end if;
  if not v_row.is_single_purse then
    raise exception 'This class does not use the Single Purse structure';
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    raise exception 'Rider level must be 1-4';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'payout.calculate') then
    raise exception 'Missing permission: payout.calculate';
  end if;
  if not public.show_is_editable(v_row.show_id) then
    raise exception 'Show is not editable';
  end if;

  update public.entry_classes set rider_level = p_level where id = p_entry_class;

  perform public.log_audit(v_row.organization_id, 'entry.rider_level_set', 'entry_class', p_entry_class::text,
    jsonb_build_object('rider_level', v_row.rider_level),
    jsonb_build_object('rider_level', p_level, 'class_number', v_row.class_number),
    null, v_row.show_id);
end;
$$;

revoke execute on function public.set_rider_level(uuid, integer) from anon;

-- ------------------------------------------------------------
-- calculate_payouts: guard against being called on a Single Purse
-- class (identical body to 00027's version otherwise).
-- ------------------------------------------------------------

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
  if v_class.is_single_purse then
    raise exception 'This class uses the Single Purse structure — use calculate_single_purse_payouts instead';
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

  update public.results set money_won_cents = 0
  where class_id = p_class;

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

-- ------------------------------------------------------------
-- calculate_single_purse_payouts
-- Sections 1-3 of Show Rules I(7).
-- ------------------------------------------------------------

create or replace function public.calculate_single_purse_payouts(p_class uuid)
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
  v_total_entries int;
  v_level4_entries int;
  v_level1_entries int;
  v_pay_spots int;
  v_tier4 int := 0;
  v_tier3 int := 0;
  v_tier2 int := 0;
  v_tier1 int := 0;
  v_remaining int;
  v_unfixed_tiers int[] := array[4,3,2,1];
  v_base int;
  v_rem int;
  v_i int;
  v_tier_num int;
  v_champ4 uuid;
  v_champ3 uuid;
  v_champ2 uuid;
  v_champ1 uuid;
  v_row record;
begin
  select * into v_class from public.classes where id = p_class;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  if not v_class.is_single_purse then
    raise exception 'This class does not use the Single Purse structure — use calculate_payouts instead';
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

  -- Section 1: pay-spot count
  select count(*) into v_total_entries
  from public.entry_classes where class_id = p_class and status = 'entered';

  if v_total_entries % 2 = 0 then
    v_pay_spots := v_total_entries / 2;
  else
    v_pay_spots := (v_total_entries + 1) / 2;
  end if;
  v_pay_spots := least(v_pay_spots, 60);

  select count(*) filter (where rider_level = 4), count(*) filter (where rider_level = 1)
  into v_level4_entries, v_level1_entries
  from public.entry_classes where class_id = p_class and status = 'entered';

  -- Section 2: tier allocation
  v_remaining := v_pay_spots;

  if v_level4_entries > 0.25 * v_total_entries then
    v_tier4 := ceil(v_level4_entries / 2.0)::int;
    v_remaining := v_remaining - v_tier4;
    v_unfixed_tiers := array_remove(v_unfixed_tiers, 4);
  end if;

  if v_level1_entries < 0.25 * v_total_entries then
    v_tier1 := v_level1_entries / 2;
    v_remaining := v_remaining - v_tier1;
    v_unfixed_tiers := array_remove(v_unfixed_tiers, 1);
  end if;

  v_remaining := greatest(v_remaining, 0);
  v_base := v_remaining / array_length(v_unfixed_tiers, 1);
  v_rem := v_remaining % array_length(v_unfixed_tiers, 1);

  for v_i in 1..array_length(v_unfixed_tiers, 1) loop
    v_tier_num := v_unfixed_tiers[v_i];
    if v_tier_num = 4 then v_tier4 := v_base + (case when v_i <= v_rem then 1 else 0 end);
    elsif v_tier_num = 3 then v_tier3 := v_base + (case when v_i <= v_rem then 1 else 0 end);
    elsif v_tier_num = 2 then v_tier2 := v_base + (case when v_i <= v_rem then 1 else 0 end);
    elsif v_tier_num = 1 then v_tier1 := v_base + (case when v_i <= v_rem then 1 else 0 end);
    end if;
  end loop;

  -- Reset before recompute
  update public.results set money_won_cents = 0, champion_level = null
  where class_id = p_class;

  -- Eligibility-gated, proportionally-redistributed payout. Zone rank
  -- 1 = tier4's own band (placings 1..v_tier4), 2 = tier3's own band,
  -- 3 = tier2's own band, 4 = tier1's own band. A rider of level L can
  -- cash in zone rank Z iff L <= 5 - Z (level 1 reaches every zone,
  -- level 4 only zone 1).
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
  ),
  entry_rows as (
    select
      r.entry_class_id,
      ec.rider_level,
      (v_pool_cents * pt.percent_sum / 100.0 / pt.n_tied) as base_share,
      case
        when r."placing" <= v_tier4 then 1
        when r."placing" <= v_tier4 + v_tier3 then 2
        when r."placing" <= v_tier4 + v_tier3 + v_tier2 then 3
        when r."placing" <= v_tier4 + v_tier3 + v_tier2 + v_tier1 then 4
        else null
      end as zone_rank
    from public.results r
    join public.entry_classes ec on ec.id = r.entry_class_id
    join placing_totals pt on pt."placing" = r."placing"
    where r.class_id = p_class
  ),
  eligibility as (
    select *,
      (zone_rank is not null and rider_level is not null and rider_level <= (5 - zone_rank)) as is_eligible
    from entry_rows
  ),
  totals as (
    select
      coalesce(sum(base_share), 0) as total_share,
      coalesce(sum(base_share) filter (where is_eligible), 0) as eligible_share
    from eligibility
  )
  update public.results r
  set money_won_cents = case
    when e.is_eligible and t.eligible_share > 0
      then round(e.base_share * t.total_share / t.eligible_share)
    else 0
  end
  from eligibility e, totals t
  where r.entry_class_id = e.entry_class_id and r.class_id = p_class;

  -- Section 3(c): level champions (best-effort interpretation — see
  -- migration header comment). Walk the overall placing order; each
  -- title goes to the highest-placed entry that hasn't already been
  -- crowned and (except the outright Level 4 title) isn't disqualified
  -- by its own rider_level from that title. Section 3(A): "Level
  -- championships are only awarded to placings within the payout of
  -- the class" — every search below is restricted to placing <=
  -- v_pay_spots.
  select entry_class_id into v_champ4
  from public.results where class_id = p_class and "placing" = 1 and "placing" <= v_pay_spots
  limit 1;
  if v_champ4 is not null then
    update public.results set champion_level = 4 where entry_class_id = v_champ4;
  end if;

  select r.entry_class_id into v_champ3
  from public.results r
  join public.entry_classes ec on ec.id = r.entry_class_id
  where r.class_id = p_class and r."placing" is not null and r."placing" <= v_pay_spots
    and r.entry_class_id is distinct from v_champ4
    and ec.rider_level is not null and ec.rider_level <> 4
  order by r."placing"
  limit 1;
  if v_champ3 is not null then
    update public.results set champion_level = 3 where entry_class_id = v_champ3;
  end if;

  select r.entry_class_id into v_champ2
  from public.results r
  join public.entry_classes ec on ec.id = r.entry_class_id
  where r.class_id = p_class and r."placing" is not null and r."placing" <= v_pay_spots
    and r.entry_class_id is distinct from v_champ4
    and r.entry_class_id is distinct from v_champ3
    and ec.rider_level is not null and ec.rider_level not in (3, 4)
  order by r."placing"
  limit 1;
  if v_champ2 is not null then
    update public.results set champion_level = 2 where entry_class_id = v_champ2;
  end if;

  select r.entry_class_id into v_champ1
  from public.results r
  join public.entry_classes ec on ec.id = r.entry_class_id
  where r.class_id = p_class and r."placing" is not null and r."placing" <= v_pay_spots
    and r.entry_class_id is distinct from v_champ4
    and r.entry_class_id is distinct from v_champ3
    and r.entry_class_id is distinct from v_champ2
    and ec.rider_level = 1
  order by r."placing"
  limit 1;
  if v_champ1 is not null then
    update public.results set champion_level = 1 where entry_class_id = v_champ1;
  end if;

  perform public.log_audit(v_class.organization_id, 'payout.calculated', 'class', p_class::text,
    null, jsonb_build_object(
      'structure', 'single_purse', 'pool_cents', v_pool_cents, 'retainage_percent', v_retainage,
      'pay_spots', v_pay_spots, 'tier4', v_tier4, 'tier3', v_tier3, 'tier2', v_tier2, 'tier1', v_tier1
    ));
end;
$$;

revoke execute on function public.calculate_single_purse_payouts(uuid) from anon;
