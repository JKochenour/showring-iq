-- ============================================================
-- ShowRing IQ — Concurrent classes
-- Per NRHA Show Rules, several class pairings (Rookie Professional +
-- Open, Rookie Level 1 + Level 2 + Prime Time Rookie, Prime Time Open
-- + Category 2 levels, etc.) run as ONE physical go: a horse/rider
-- passes through the pen once, and that single run counts toward
-- placings in multiple named classes at once. Rule F(10): "When
-- classes run concurrently... a horse may be shown only once."
--
-- Deliberately generic — a show links whichever classes it wants as
-- "runs concurrent" (classes.concurrent_group_id), not a hard-coded
-- NRHA pairing list (that judgment stays with the secretary/rule
-- package, per CLAUDE.md's "rules are data, not code"). What this
-- migration actually automates is the mechanical consequence of
-- concurrency: one shared draw across the grouped classes
-- (class_draws.shared_run_id ties together the class_draws rows that
-- represent the same physical run), gate status changes propagating
-- to every class a run belongs to, and a score entered/corrected in
-- one class auto-mirroring to every sibling class the same entry is
-- in — so office staff enter it once instead of once per class.
-- Results/placings need no changes: calculate_results already
-- computes independently per class from each class's own
-- entry_classes/scores, which now just happen to be correctly kept
-- in sync.
-- ============================================================

alter table public.classes
  add column concurrent_group_id uuid;

create index classes_concurrent_group_idx
  on public.classes (concurrent_group_id)
  where concurrent_group_id is not null;

alter table public.class_draws
  add column shared_run_id uuid;

create index class_draws_shared_run_idx
  on public.class_draws (shared_run_id)
  where shared_run_id is not null;

-- ------------------------------------------------------------
-- Helper: copy the just-written state of one entry_class's score to
-- every sibling entry_class sharing the same physical run (same
-- shared_run_id on class_draws, different class). A no-op for any
-- entry_class not part of a concurrent group's shared run.
-- ------------------------------------------------------------

create or replace function public.mirror_score_to_concurrent_siblings(p_entry_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source record;
  v_shared_run uuid;
  v_sibling record;
begin
  select * into v_source from public.scores where entry_class_id = p_entry_class;
  if v_source is null then
    return;
  end if;

  select shared_run_id into v_shared_run
  from public.class_draws
  where entry_class_id = p_entry_class;

  if v_shared_run is null then
    return;
  end if;

  for v_sibling in
    select cd.entry_class_id
    from public.class_draws cd
    where cd.shared_run_id = v_shared_run
      and cd.entry_class_id <> p_entry_class
  loop
    insert into public.scores (
      entry_class_id, judge_staff_id, judge_name, result_status,
      total_score_tenths, penalty_points_tenths, notes, status,
      submitted_at, submitted_by, verified_at, verified_by,
      signature_name, signed_by_staff_id, signed_at
    )
    values (
      v_sibling.entry_class_id, v_source.judge_staff_id, v_source.judge_name, v_source.result_status,
      v_source.total_score_tenths, v_source.penalty_points_tenths, v_source.notes, v_source.status,
      v_source.submitted_at, v_source.submitted_by, v_source.verified_at, v_source.verified_by,
      v_source.signature_name, v_source.signed_by_staff_id, v_source.signed_at
    )
    on conflict (entry_class_id) do update set
      judge_staff_id = excluded.judge_staff_id,
      judge_name = excluded.judge_name,
      result_status = excluded.result_status,
      total_score_tenths = excluded.total_score_tenths,
      penalty_points_tenths = excluded.penalty_points_tenths,
      notes = excluded.notes,
      status = excluded.status,
      submitted_at = excluded.submitted_at,
      submitted_by = excluded.submitted_by,
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by,
      signature_name = excluded.signature_name,
      signed_by_staff_id = excluded.signed_by_staff_id,
      signed_at = excluded.signed_at;
  end loop;
end;
$$;

revoke execute on function public.mirror_score_to_concurrent_siblings(uuid) from anon;
revoke execute on function public.mirror_score_to_concurrent_siblings(uuid) from authenticated;

-- ------------------------------------------------------------
-- enter_score / submit_score / verify_score / reopen_score /
-- correct_score: identical bodies to the currently-active versions
-- (enter_score from 00016, submit_score/reopen_score from 00019,
-- verify_score/correct_score from 00008), each with a mirror call
-- added before returning.
-- ------------------------------------------------------------

create or replace function public.enter_score(
  p_entry_class uuid,
  p_result_status text,
  p_total_score_tenths integer default null,
  p_judge_staff_id uuid default null,
  p_penalty_points_tenths integer default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ec record;
  v_existing record;
  v_judge_name text;
  v_score_id uuid;
  v_assigned_judge uuid;
begin
  select ec.*, e.status as entry_status
  into v_ec
  from public.entry_classes ec
  join public.entries e on e.id = ec.entry_id
  where ec.id = p_entry_class;

  if v_ec is null then
    raise exception 'Entry class not found';
  end if;
  if not public.has_org_permission(v_ec.organization_id, 'score.enter') then
    raise exception 'Missing permission: score.enter';
  end if;
  if v_ec.status <> 'entered' or v_ec.entry_status <> 'active' then
    raise exception 'This entry is scratched and cannot be scored';
  end if;

  if not public.has_org_permission(v_ec.organization_id, 'score.edit_unofficial') then
    v_assigned_judge := public.assigned_judge_staff_id(v_ec.class_id);
    if v_assigned_judge is null then
      raise exception 'You are not assigned as judge for this class';
    end if;
    if p_judge_staff_id is not null and p_judge_staff_id <> v_assigned_judge then
      raise exception 'You can only enter scores under your own judge assignment';
    end if;
    p_judge_staff_id := v_assigned_judge;
  end if;

  perform public.validate_score_consistency(p_result_status, p_total_score_tenths);

  select * into v_existing from public.scores where entry_class_id = p_entry_class;
  if v_existing is not null and v_existing.status <> 'pending' then
    raise exception 'Score has already been submitted; use a correction instead';
  end if;

  if p_judge_staff_id is not null then
    select display_name into v_judge_name from public.show_staff where id = p_judge_staff_id;
  end if;

  if v_existing is null then
    insert into public.scores (
      entry_class_id, judge_staff_id, judge_name, result_status,
      total_score_tenths, penalty_points_tenths, notes
    )
    values (
      p_entry_class, p_judge_staff_id, v_judge_name, p_result_status,
      p_total_score_tenths, coalesce(p_penalty_points_tenths, 0), p_notes
    )
    returning id into v_score_id;
  else
    update public.scores set
      judge_staff_id = p_judge_staff_id,
      judge_name = v_judge_name,
      result_status = p_result_status,
      total_score_tenths = p_total_score_tenths,
      penalty_points_tenths = coalesce(p_penalty_points_tenths, 0),
      notes = p_notes
    where entry_class_id = p_entry_class
    returning id into v_score_id;
  end if;

  update public.classes
  set status = 'scoring'
  where id = v_ec.class_id and status in ('draw_posted', 'in_progress');

  perform public.mirror_score_to_concurrent_siblings(p_entry_class);

  return v_score_id;
end;
$$;

create or replace function public.submit_score(
  p_entry_class uuid,
  p_signature_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score record;
  v_signature text;
begin
  select * into v_score from public.scores where entry_class_id = p_entry_class;
  if v_score is null then
    raise exception 'No score entered yet';
  end if;
  if not public.has_org_permission(v_score.organization_id, 'score.enter') then
    raise exception 'Missing permission: score.enter';
  end if;
  if not public.has_org_permission(v_score.organization_id, 'score.edit_unofficial')
     and public.assigned_judge_staff_id(v_score.class_id) is null then
    raise exception 'You are not assigned as judge for this class';
  end if;
  if v_score.status <> 'pending' then
    return;
  end if;

  v_signature := nullif(btrim(coalesce(p_signature_name, '')), '');
  if v_signature is null then
    select display_name into v_signature from public.show_staff where id = v_score.judge_staff_id;
  end if;
  if v_signature is null then
    raise exception 'A signature (typed name) is required to submit a score card';
  end if;

  update public.scores
  set status = 'submitted', submitted_at = now(), submitted_by = (select auth.uid()),
      signature_name = v_signature, signed_by_staff_id = v_score.judge_staff_id, signed_at = now()
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.submitted', 'score', v_score.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'submitted', 'total_score_tenths', v_score.total_score_tenths,
                       'result_status', v_score.result_status),
    null, v_score.show_id);

  perform public.log_audit(v_score.organization_id, 'score.signed', 'score', v_score.id::text,
    null,
    jsonb_build_object('signature_name', v_signature, 'signed_by_staff_id', v_score.judge_staff_id),
    null, v_score.show_id);

  perform public.mirror_score_to_concurrent_siblings(p_entry_class);
end;
$$;

create or replace function public.verify_score(p_entry_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score record;
begin
  select * into v_score from public.scores where entry_class_id = p_entry_class;
  if v_score is null then
    raise exception 'No score entered yet';
  end if;
  if not public.has_org_permission(v_score.organization_id, 'score.verify') then
    raise exception 'Missing permission: score.verify';
  end if;
  if v_score.status <> 'submitted' then
    raise exception 'Only submitted scores can be verified';
  end if;

  update public.scores
  set status = 'verified', verified_at = now(), verified_by = (select auth.uid())
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.verified', 'score', v_score.id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'verified'));

  perform public.mirror_score_to_concurrent_siblings(p_entry_class);
end;
$$;

create or replace function public.reopen_score(p_entry_class uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score record;
  v_new_status text;
  v_permission text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reopen a score';
  end if;

  select * into v_score from public.scores where entry_class_id = p_entry_class;
  if v_score is null then
    raise exception 'No score entered yet';
  end if;

  if v_score.status = 'verified' then
    v_new_status := 'submitted'; v_permission := 'score.verify';
  elsif v_score.status = 'submitted' then
    v_new_status := 'pending'; v_permission := 'score.enter';
  else
    return;
  end if;

  if not public.has_org_permission(v_score.organization_id, v_permission) then
    raise exception 'Missing permission: %', v_permission;
  end if;
  if v_permission = 'score.enter'
     and not public.has_org_permission(v_score.organization_id, 'score.edit_unofficial')
     and public.assigned_judge_staff_id(v_score.class_id) is null then
    raise exception 'You are not assigned as judge for this class';
  end if;

  update public.scores set
    status = v_new_status,
    signature_name = case when v_new_status = 'pending' then null else signature_name end,
    signed_by_staff_id = case when v_new_status = 'pending' then null else signed_by_staff_id end,
    signed_at = case when v_new_status = 'pending' then null else signed_at end
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.reopened', 'score', v_score.id::text,
    jsonb_build_object('status', v_score.status),
    jsonb_build_object('status', v_new_status),
    p_reason, v_score.show_id);

  perform public.mirror_score_to_concurrent_siblings(p_entry_class);
end;
$$;

create or replace function public.correct_score(
  p_entry_class uuid,
  p_correction_type text,
  p_result_status text,
  p_total_score_tenths integer,
  p_penalty_points_tenths integer,
  p_notes text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score record;
  v_permission text;
begin
  if p_correction_type not in ('judge_sheet_correction', 'data_entry_correction') then
    raise exception 'Invalid correction type: %', p_correction_type;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to correct a score';
  end if;

  select * into v_score from public.scores where entry_class_id = p_entry_class;
  if v_score is null then
    raise exception 'No score entered yet';
  end if;

  v_permission := case when v_score.status = 'verified' then 'score.correct_official' else 'score.edit_unofficial' end;
  if not public.has_org_permission(v_score.organization_id, v_permission) then
    raise exception 'Missing permission: %', v_permission;
  end if;

  perform public.validate_score_consistency(p_result_status, p_total_score_tenths);

  update public.scores set
    result_status = p_result_status,
    total_score_tenths = p_total_score_tenths,
    penalty_points_tenths = coalesce(p_penalty_points_tenths, 0),
    notes = p_notes
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.corrected', 'score', v_score.id::text,
    jsonb_build_object('result_status', v_score.result_status, 'total_score_tenths', v_score.total_score_tenths,
                       'correction_type', p_correction_type),
    jsonb_build_object('result_status', p_result_status, 'total_score_tenths', p_total_score_tenths),
    p_reason);

  perform public.mirror_score_to_concurrent_siblings(p_entry_class);
end;
$$;

revoke execute on function public.enter_score(uuid, text, integer, uuid, integer, text) from anon;
revoke execute on function public.submit_score(uuid, text) from anon;
revoke execute on function public.verify_score(uuid) from anon;
revoke execute on function public.reopen_score(uuid, text) from anon;
revoke execute on function public.correct_score(uuid, text, text, integer, integer, text, text) from anon;

-- ------------------------------------------------------------
-- set_run_status: gate status and scratches now propagate across
-- every class_draws row sharing the same shared_run_id (same
-- physical run), and "mark in-arena auto-completes the previous
-- in-arena run" now looks across the whole concurrent group, not
-- just one class, since only one entry can physically be in the
-- arena for the group at a time.
-- ------------------------------------------------------------

create or replace function public.set_run_status(
  p_row uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_group uuid;
begin
  if p_status not in ('pending', 'at_gate', 'in_arena', 'completed', 'hold', 'no_show', 'scratched') then
    raise exception 'Invalid run status: %', p_status;
  end if;

  select * into v_row from public.class_draws where id = p_row;
  if v_row is null then
    raise exception 'Draw row not found';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'entry.check_in') then
    raise exception 'Missing permission: entry.check_in';
  end if;
  if v_row.run_status = p_status then
    return;
  end if;

  if p_status = 'scratched' then
    if not public.has_org_permission(v_row.organization_id, 'entry.scratch') then
      raise exception 'Missing permission: entry.scratch';
    end if;
    if v_row.shared_run_id is not null then
      update public.entry_classes ec
      set status = 'scratched',
          scratch_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), ec.scratch_reason)
      from public.class_draws cd
      where cd.shared_run_id = v_row.shared_run_id
        and ec.id = cd.entry_class_id
        and ec.status = 'entered';
    else
      update public.entry_classes
      set status = 'scratched',
          scratch_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), scratch_reason)
      where id = v_row.entry_class_id and status = 'entered';
    end if;
  end if;

  select c.concurrent_group_id into v_group from public.classes c where c.id = v_row.class_id;

  if p_status = 'in_arena' then
    if v_group is not null then
      update public.class_draws cd
      set run_status = 'completed'
      from public.classes c
      where c.id = cd.class_id
        and c.concurrent_group_id = v_group
        and cd.run_status = 'in_arena'
        and cd.id <> p_row;
    else
      update public.class_draws
      set run_status = 'completed'
      where class_id = v_row.class_id and run_status = 'in_arena' and id <> p_row;
    end if;
  end if;

  if v_row.shared_run_id is not null then
    update public.class_draws set run_status = p_status where shared_run_id = v_row.shared_run_id;
  else
    update public.class_draws set run_status = p_status where id = p_row;
  end if;

  if p_status in ('hold', 'no_show', 'scratched') then
    perform public.log_audit(v_row.organization_id, 'gate.' || p_status, 'class_draw', p_row::text,
      jsonb_build_object('class_id', v_row.class_id, 'previous', v_row.run_status),
      jsonb_build_object('run_status', p_status),
      p_reason);
  end if;
end;
$$;

revoke execute on function public.set_run_status(uuid, text, text) from anon;
