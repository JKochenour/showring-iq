-- ============================================================
-- ShowRing IQ — Tie run-off / co-champion resolution
-- Per Show Rules O. Ties: only a 1st-place tie may be worked off (7)
-- ("Only ties for 1st place may be worked off. Other ties will
-- stand."). Money for a standing tie already splits evenly across
-- every entry sharing a placing — calculate_payouts
-- (00011_payouts_rule_packages.sql) already divides a placing's
-- combined payout percent by the number of tied entries, so co-
-- champions are already paid correctly with zero changes needed here.
--
-- What's missing is a record of *how* a 1st-place tie was resolved:
-- co-champions by mutual agreement (O(1)/(3), still split money, but
-- rule (4) says the tiebreaker loser may buy a duplicate trophy — a
-- physical-award detail worth a note, not a data change), or a
-- run-off (O(2)/(5)/(6)) — which is really just a score correction
-- for the tied entries (correct_score already exists) followed by a
-- normal recalculate, since the run-off "same pattern and order of
-- go" produces a new, presumably differentiating score.
-- ============================================================

alter table public.results
  add column tie_resolution text check (tie_resolution in ('co_champions', 'run_off_completed')),
  add column tie_resolution_note text;

-- ------------------------------------------------------------
-- RPC: record how a 1st-place tie was resolved. Applies to every
-- result row sharing the tied placing, not just one entry — a tie
-- resolution describes the whole group.
-- ------------------------------------------------------------

create or replace function public.resolve_tie(
  p_entry_class uuid,
  p_resolution text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_class record;
begin
  if p_resolution not in ('co_champions', 'run_off_completed') then
    raise exception 'Invalid tie resolution: %', p_resolution;
  end if;

  select * into v_result from public.results where entry_class_id = p_entry_class;
  if v_result is null then
    raise exception 'No result found for this entry';
  end if;
  if v_result."placing" is distinct from 1 or v_result.tie_status <> 'tied' then
    raise exception 'Only a 1st-place tie can be resolved this way';
  end if;

  select * into v_class from public.classes where id = v_result.class_id;
  if not public.has_org_permission(v_class.organization_id, 'result.publish') then
    raise exception 'Missing permission: result.publish';
  end if;

  update public.results
  set tie_resolution = p_resolution,
      tie_resolution_note = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now()
  where class_id = v_result.class_id and "placing" = 1;

  perform public.log_audit(v_class.organization_id, 'result.tie_resolved', 'class', v_result.class_id::text,
    null,
    jsonb_build_object('resolution', p_resolution, 'note', p_note, 'class_number', v_class.class_number),
    null, v_class.show_id);
end;
$$;

revoke execute on function public.resolve_tie(uuid, text, text) from anon;

-- ------------------------------------------------------------
-- calculate_results: identical to the 00009 body, except a
-- recalculation now clears any prior tie_resolution/note on rows
-- whose placing/tie_status it touches — a stale "declared
-- co-champions" note shouldn't survive a recalculation that changes
-- the standings (e.g. after a run-off score correction).
-- ------------------------------------------------------------

create or replace function public.calculate_results(p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
begin
  select * into v_class from public.classes where id = p_class;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  if not public.has_org_permission(v_class.organization_id, 'result.publish') then
    raise exception 'Missing permission: result.publish';
  end if;
  if v_class.status not in ('official', 'results_posted') then
    raise exception 'Class must be marked official before results can be calculated';
  end if;

  with ranked as (
    select
      ec.id as entry_class_id,
      rank() over (order by s.total_score_tenths desc) as computed_placing,
      count(*) over (partition by s.total_score_tenths) as tie_count
    from public.entry_classes ec
    join public.scores s on s.entry_class_id = ec.id
    where ec.class_id = p_class
      and ec.status = 'entered'
      and s.result_status in ('shown', 'zero')
      and s.total_score_tenths is not null
  )
  insert into public.results (entry_class_id, class_id, show_id, organization_id, "placing", tie_status)
  select r.entry_class_id, p_class, v_class.show_id, v_class.organization_id,
         r.computed_placing, case when r.tie_count > 1 then 'tied' else 'none' end
  from ranked r
  on conflict (entry_class_id) do update set
    "placing" = excluded."placing",
    tie_status = excluded.tie_status,
    tie_resolution = null,
    tie_resolution_note = null,
    updated_at = now()
  where public.results.manual_override = false;

  insert into public.results (entry_class_id, class_id, show_id, organization_id, "placing", tie_status)
  select ec.id, p_class, v_class.show_id, v_class.organization_id, null, 'none'
  from public.entry_classes ec
  left join public.scores s on s.entry_class_id = ec.id
  where ec.class_id = p_class and ec.status = 'entered'
    and not (
      s.result_status in ('shown', 'zero') and s.total_score_tenths is not null
    )
  on conflict (entry_class_id) do update set
    "placing" = null,
    tie_status = 'none',
    tie_resolution = null,
    tie_resolution_note = null,
    updated_at = now()
  where public.results.manual_override = false;

  perform public.log_audit(v_class.organization_id, 'results.calculated', 'class', p_class::text,
    null, jsonb_build_object('class_number', v_class.class_number));
end;
$$;

revoke execute on function public.calculate_results(uuid) from anon;
