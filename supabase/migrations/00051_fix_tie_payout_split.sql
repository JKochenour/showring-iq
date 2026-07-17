-- 00051: fix the tie payout split in calculate_payouts.
--
-- BUG (present since 00011, carried through 00027 and 00029): the
-- placing_totals CTE joined schedule rows on sr.placing = r.placing,
-- so a tie at placing p matched ONLY schedule row p — fanned out once
-- per tied entry. sum(percent)/n_tied then algebraically reduced to
-- "each tied entry gets placing p's full percentage", over-paying the
-- pool (2-way tie for 1st on a 60/40 schedule paid 60% + 60% = 120%
-- of the pool) and never consuming rows p+1..p+n-1.
--
-- Found 2026-07-16 during live QA: youth class, $80 pool, 60/40
-- schedule, two entries tied at 70.0 → each paid $48.00 ($96 total on
-- an $80 pool). Correct: (60+40)/2 = 50% each = $40.00.
--
-- CORRECT RULE (NRHA and standard practice, and what the UI copy
-- already promises): n entries tied at placing p split the COMBINED
-- percentages of schedule placings p .. p+n-1 evenly.
--
-- Body is otherwise identical to 00029's version (single-purse guard,
-- youth retainage exemption, reset-to-zero, audit log).

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

  -- Reset to zero first so placings no longer in the schedule/results clear out
  update public.results set money_won_cents = 0
  where class_id = p_class;

  -- n entries tied at placing p consume schedule rows p .. p+n-1 and
  -- split their combined percentage evenly. A non-tied placing (n = 1)
  -- consumes exactly its own row, unchanged from before.
  with schedule_rows as (
    select (elem->>'placing')::int as "placing", (elem->>'percent')::numeric as percent
    from jsonb_array_elements(v_schedule) elem
  ),
  placing_counts as (
    select r."placing", count(*) as n_tied
    from public.results r
    where r.class_id = p_class and r."placing" is not null
    group by r."placing"
  ),
  placing_totals as (
    select pc."placing", pc.n_tied, coalesce(sum(sr.percent), 0) as percent_sum
    from placing_counts pc
    left join schedule_rows sr
      on sr."placing" >= pc."placing"
     and sr."placing" <  pc."placing" + pc.n_tied
    group by pc."placing", pc.n_tied
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
