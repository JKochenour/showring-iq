-- ============================================================
-- ShowRing IQ — populate audit_logs.show_id
--
-- audit_logs.show_id has existed since 00001_foundation.sql but was
-- never set: log_audit() didn't accept it, and no caller passed it.
-- That leaves the NRHA export package (CLAUDE.md: submission ZIP
-- should include "the audit log") with no reliable way to produce a
-- per-show excerpt.
--
-- This migration:
--   1. Adds an optional p_show param (defaulted last, so no existing
--      positional call site breaks) to log_audit() and has it write
--      show_id.
--   2. Re-points every show-scoped RPC that already has a show_id (or
--      an entry_classes/scores/classes/class_draws row carrying one)
--      in scope to pass it through. Org-level actions (member invites,
--      rule package edits, organization/person/horse CRUD, document
--      CRUD not attached to a show) are deliberately left with a null
--      show_id — they aren't show-scoped and forcing one would be
--      fabricated data.
--
-- Every log_audit() call not touched here keeps working exactly as
-- before (p_show simply stays null) — this is additive enrichment,
-- not a behavior change.
-- ============================================================

create or replace function public.log_audit(
  p_org uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_old jsonb default null,
  p_new jsonb default null,
  p_reason text default null,
  p_show uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_member(p_org) then
    raise exception 'Not a member of this organization';
  end if;
  insert into public.audit_logs (
    organization_id, show_id, actor_user_id, actor_role, action_type,
    entity_type, entity_id, old_value, new_value, reason
  )
  values (
    p_org, p_show, (select auth.uid()), public.org_role_key(p_org), p_action,
    p_entity_type, p_entity_id, p_old, p_new, p_reason
  );
end;
$$;

-- ------------------------------------------------------------
-- 00002_shows.sql — show lifecycle
-- ------------------------------------------------------------

create or replace function public.create_show(
  p_org uuid,
  p_name text,
  p_slug text,
  p_start_date date,
  p_end_date date,
  p_timezone text default 'America/New_York',
  p_venue_name text default null,
  p_city text default null,
  p_state text default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show uuid;
begin
  if not public.has_org_permission(p_org, 'show.create') then
    raise exception 'Missing permission: show.create';
  end if;

  insert into public.shows (
    organization_id, name, slug, start_date, end_date, timezone,
    venue_name, city, state, contact_email, created_by
  )
  values (
    p_org, p_name, p_slug, p_start_date, p_end_date, p_timezone,
    p_venue_name, p_city, p_state, p_contact_email, (select auth.uid())
  )
  returning id into v_show;

  perform public.log_audit(p_org, 'show.created', 'show', v_show::text,
    null,
    jsonb_build_object('name', p_name, 'slug', p_slug,
                       'start_date', p_start_date, 'end_date', p_end_date),
    null, v_show);

  return v_show;
end;
$$;

create or replace function public.set_show_status(
  p_show uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_permission text;
  v_allowed boolean := false;
begin
  select * into v_show from public.shows where id = p_show;
  if v_show is null then
    raise exception 'Show not found';
  end if;
  if v_show.status = p_status then
    return;
  end if;

  if v_show.status = 'draft' and p_status = 'published' then
    v_permission := 'show.publish'; v_allowed := true;
  elsif v_show.status = 'published' and p_status = 'draft' then
    v_permission := 'show.publish'; v_allowed := true;
  elsif v_show.status = 'published' and p_status = 'locked' then
    v_permission := 'show.lock'; v_allowed := true;
  elsif v_show.status = 'locked' and p_status = 'published' then
    v_permission := 'show.lock'; v_allowed := true;
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Unlocking a show requires a reason';
    end if;
  elsif p_status = 'archived' then
    v_permission := 'show.archive'; v_allowed := true;
  elsif v_show.status = 'archived' and p_status = 'draft' then
    v_permission := 'show.archive'; v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'Invalid status transition: % -> %', v_show.status, p_status;
  end if;
  if not public.has_org_permission(v_show.organization_id, v_permission) then
    raise exception 'Missing permission: %', v_permission;
  end if;

  update public.shows set status = p_status where id = p_show;

  perform public.log_audit(v_show.organization_id, 'show.status_changed', 'show', p_show::text,
    jsonb_build_object('status', v_show.status),
    jsonb_build_object('status', p_status),
    p_reason, p_show);
end;
$$;

-- ------------------------------------------------------------
-- 00005_entries.sql — back numbers, entry/entry_class scratch
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
  v_num integer;
  v_existing record;
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
      jsonb_build_object('entry_id', p_entry, 'number', v_num),
      null, v_entry.show_id);
  else
    insert into public.back_numbers (show_id, organization_id, number, entry_id)
    values (v_entry.show_id, v_entry.organization_id, v_num, p_entry);
    perform public.log_audit(v_entry.organization_id, 'back_number.assigned', 'back_number', null,
      null, jsonb_build_object('entry_id', p_entry, 'number', v_num),
      null, v_entry.show_id);
  end if;

  return v_num;
end;
$$;

create or replace function public.release_back_number(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_existing record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.assign_back_number') then
    raise exception 'Missing permission: entry.assign_back_number';
  end if;

  select * into v_existing from public.back_numbers where entry_id = p_entry;
  if v_existing is null then
    return;
  end if;

  delete from public.back_numbers where entry_id = p_entry;

  perform public.log_audit(v_entry.organization_id, 'back_number.released', 'back_number', v_existing.id::text,
    jsonb_build_object('entry_id', p_entry, 'number', v_existing.number), null,
    null, v_entry.show_id);
end;
$$;

create or replace function public.scratch_entry_class(
  p_entry_class uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select ec.*, c.class_number, c.name as class_name
  into v_row
  from public.entry_classes ec
  join public.classes c on c.id = ec.class_id
  where ec.id = p_entry_class;

  if v_row is null then
    raise exception 'Entry class not found';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'entry.scratch') then
    raise exception 'Missing permission: entry.scratch';
  end if;
  if v_row.status = 'scratched' then
    return;
  end if;

  update public.entry_classes
  set status = 'scratched', scratch_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_entry_class;

  perform public.log_audit(v_row.organization_id, 'entry.class_scratched', 'entry_class', p_entry_class::text,
    jsonb_build_object('entry_id', v_row.entry_id, 'class', v_row.class_number, 'status', 'entered'),
    jsonb_build_object('status', 'scratched'),
    p_reason, v_row.show_id);
end;
$$;

create or replace function public.reinstate_entry_class(p_entry_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select ec.*, c.class_number
  into v_row
  from public.entry_classes ec
  join public.classes c on c.id = ec.class_id
  where ec.id = p_entry_class;

  if v_row is null then
    raise exception 'Entry class not found';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'entry.reinstate') then
    raise exception 'Missing permission: entry.reinstate';
  end if;
  if v_row.status = 'entered' then
    return;
  end if;

  update public.entry_classes
  set status = 'entered', scratch_reason = null
  where id = p_entry_class;

  perform public.log_audit(v_row.organization_id, 'entry.class_reinstated', 'entry_class', p_entry_class::text,
    jsonb_build_object('entry_id', v_row.entry_id, 'class', v_row.class_number, 'status', 'scratched'),
    jsonb_build_object('status', 'entered'),
    null, v_row.show_id);
end;
$$;

create or replace function public.scratch_entry(
  p_entry uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.scratch') then
    raise exception 'Missing permission: entry.scratch';
  end if;
  if v_entry.status = 'scratched' then
    return;
  end if;

  update public.entry_classes
  set status = 'scratched', scratch_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), scratch_reason)
  where entry_id = p_entry and status = 'entered';

  update public.entries set status = 'scratched' where id = p_entry;

  perform public.log_audit(v_entry.organization_id, 'entry.scratched', 'entry', p_entry::text,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'scratched'),
    p_reason, v_entry.show_id);
end;
$$;

create or replace function public.reinstate_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.reinstate') then
    raise exception 'Missing permission: entry.reinstate';
  end if;
  if v_entry.status = 'active' then
    return;
  end if;

  -- Entry becomes active again; classes stay scratched until reinstated
  -- individually (the secretary decides which ones come back).
  update public.entries set status = 'active' where id = p_entry;

  perform public.log_audit(v_entry.organization_id, 'entry.reinstated', 'entry', p_entry::text,
    jsonb_build_object('status', 'scratched'),
    jsonb_build_object('status', 'active'),
    null, v_entry.show_id);
end;
$$;

-- ------------------------------------------------------------
-- 00006_checkin_validation.sql — check-in
-- ------------------------------------------------------------

create or replace function public.check_in_entry(
  p_entry uuid,
  p_override_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.check_in') then
    raise exception 'Missing permission: entry.check_in';
  end if;
  if v_entry.status = 'scratched' then
    raise exception 'Scratched entries cannot be checked in';
  end if;
  if v_entry.checked_in_at is not null then
    return;
  end if;

  update public.entries
  set checked_in_at = now(), checked_in_by = (select auth.uid())
  where id = p_entry;

  perform public.log_audit(v_entry.organization_id,
    case when p_override_reason is not null then 'entry.checked_in_with_override'
         else 'entry.checked_in' end,
    'entry', p_entry::text,
    null,
    jsonb_build_object('entry_number', v_entry.entry_number),
    p_override_reason, v_entry.show_id);
end;
$$;

create or replace function public.undo_check_in(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.check_in') then
    raise exception 'Missing permission: entry.check_in';
  end if;
  if v_entry.checked_in_at is null then
    return;
  end if;

  update public.entries
  set checked_in_at = null, checked_in_by = null
  where id = p_entry;

  perform public.log_audit(v_entry.organization_id, 'entry.check_in_undone', 'entry', p_entry::text,
    jsonb_build_object('entry_number', v_entry.entry_number, 'checked_in_at', v_entry.checked_in_at),
    null, null, v_entry.show_id);
end;
$$;

-- ------------------------------------------------------------
-- 00007_draws.sql — draw reorder / gate status
-- ------------------------------------------------------------

create or replace function public.move_draw_row(p_row uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_neighbor record;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Direction must be up or down';
  end if;

  select * into v_row from public.class_draws where id = p_row;
  if v_row is null then
    raise exception 'Draw row not found';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'class.schedule') then
    raise exception 'Missing permission: class.schedule';
  end if;

  if p_direction = 'up' then
    select * into v_neighbor from public.class_draws
    where class_id = v_row.class_id and position < v_row.position
    order by position desc limit 1;
  else
    select * into v_neighbor from public.class_draws
    where class_id = v_row.class_id and position > v_row.position
    order by position asc limit 1;
  end if;

  if v_neighbor is null then
    return;
  end if;

  update public.class_draws set position = v_neighbor.position where id = v_row.id;
  update public.class_draws set position = v_row.position where id = v_neighbor.id;

  perform public.log_audit(v_row.organization_id, 'draw.reordered', 'class_draw', p_row::text,
    jsonb_build_object('class_id', v_row.class_id, 'position', v_row.position),
    jsonb_build_object('position', v_neighbor.position),
    null, v_row.show_id);
end;
$$;

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
    update public.entry_classes
    set status = 'scratched',
        scratch_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), scratch_reason)
    where id = v_row.entry_class_id and status = 'entered';
  end if;

  if p_status = 'in_arena' then
    update public.class_draws
    set run_status = 'completed'
    where class_id = v_row.class_id and run_status = 'in_arena' and id <> p_row;
  end if;

  update public.class_draws set run_status = p_status where id = p_row;

  if p_status in ('hold', 'no_show', 'scratched') then
    perform public.log_audit(v_row.organization_id, 'gate.' || p_status, 'class_draw', p_row::text,
      jsonb_build_object('class_id', v_row.class_id, 'previous', v_row.run_status),
      jsonb_build_object('run_status', p_status),
      p_reason, v_row.show_id);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 00008/00016_scoring.sql — scoring lifecycle (bodies below match
-- the latest versions, i.e. 00016's judge-assignment-tightened
-- enter_score/submit_score/reopen_score; 00008's unchanged
-- verify_score/correct_score/mark_class_scoring_complete/
-- mark_class_official)
-- ------------------------------------------------------------

create or replace function public.submit_score(p_entry_class uuid)
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

  update public.scores
  set status = 'submitted', submitted_at = now(), submitted_by = (select auth.uid())
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.submitted', 'score', v_score.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'submitted', 'total_score_tenths', v_score.total_score_tenths,
                       'result_status', v_score.result_status),
    null, v_score.show_id);
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
    jsonb_build_object('status', 'verified'),
    null, v_score.show_id);
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

  update public.scores set status = v_new_status where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.reopened', 'score', v_score.id::text,
    jsonb_build_object('status', v_score.status),
    jsonb_build_object('status', v_new_status),
    p_reason, v_score.show_id);
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
    p_reason, v_score.show_id);
end;
$$;

create or replace function public.mark_class_scoring_complete(p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
  v_unverified int;
begin
  select * into v_class from public.classes where id = p_class;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  if not public.has_org_permission(v_class.organization_id, 'score.verify') then
    raise exception 'Missing permission: score.verify';
  end if;

  select count(*) into v_unverified
  from public.entry_classes ec
  left join public.scores s on s.entry_class_id = ec.id
  where ec.class_id = p_class and ec.status = 'entered'
    and (s.id is null or s.status <> 'verified');

  if v_unverified > 0 then
    raise exception '% entr% still need a verified score', v_unverified,
      case when v_unverified = 1 then 'y' else 'ies' end;
  end if;

  update public.classes set status = 'pending_verification'
  where id = p_class and status in ('draw_posted', 'in_progress', 'scoring');

  perform public.log_audit(v_class.organization_id, 'class.scoring_completed', 'class', p_class::text,
    jsonb_build_object('status', v_class.status), jsonb_build_object('status', 'pending_verification'),
    null, v_class.show_id);
end;
$$;

create or replace function public.mark_class_official(p_class uuid)
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
  if not public.has_org_permission(v_class.organization_id, 'score.finalize') then
    raise exception 'Missing permission: score.finalize';
  end if;
  if v_class.status <> 'pending_verification' then
    raise exception 'Class must be pending verification first';
  end if;

  update public.classes set status = 'official' where id = p_class;

  perform public.log_audit(v_class.organization_id, 'class.marked_official', 'class', p_class::text,
    jsonb_build_object('status', 'pending_verification'), jsonb_build_object('status', 'official'),
    null, v_class.show_id);
end;
$$;

-- ------------------------------------------------------------
-- 00009_results.sql — placings / publish
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
    "placing" = null, tie_status = 'none', updated_at = now()
  where public.results.manual_override = false;

  perform public.log_audit(v_class.organization_id, 'results.calculated', 'class', p_class::text,
    null, jsonb_build_object('class_number', v_class.class_number),
    null, v_class.show_id);
end;
$$;

create or replace function public.override_placing(
  p_entry_class uuid,
  p_placing integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ec record;
  v_class record;
  v_old record;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to override a placing';
  end if;

  select * into v_ec from public.entry_classes where id = p_entry_class;
  if v_ec is null then
    raise exception 'Entry class not found';
  end if;
  select * into v_class from public.classes where id = v_ec.class_id;
  if not public.has_org_permission(v_class.organization_id, 'result.publish') then
    raise exception 'Missing permission: result.publish';
  end if;

  select * into v_old from public.results where entry_class_id = p_entry_class;

  insert into public.results (entry_class_id, class_id, show_id, organization_id, "placing", manual_override)
  values (p_entry_class, v_ec.class_id, v_ec.show_id, v_ec.organization_id, p_placing, true)
  on conflict (entry_class_id) do update set
    "placing" = p_placing, manual_override = true, updated_at = now();

  perform public.log_audit(v_class.organization_id, 'result.placing_corrected', 'result', p_entry_class::text,
    jsonb_build_object('placing', v_old."placing", 'correction_type', 'placing_correction'),
    jsonb_build_object('placing', p_placing),
    p_reason, v_ec.show_id);
end;
$$;

create or replace function public.publish_results(p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
  v_count int;
begin
  select * into v_class from public.classes where id = p_class;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  if not public.has_org_permission(v_class.organization_id, 'result.publish') then
    raise exception 'Missing permission: result.publish';
  end if;
  if v_class.status <> 'official' then
    raise exception 'Class must be official before results can be posted';
  end if;

  select count(*) into v_count from public.results where class_id = p_class;
  if v_count = 0 then
    raise exception 'Calculate results before posting them';
  end if;

  update public.classes set status = 'results_posted' where id = p_class;

  perform public.log_audit(v_class.organization_id, 'results.posted', 'class', p_class::text,
    jsonb_build_object('status', 'official'), jsonb_build_object('status', 'results_posted'),
    null, v_class.show_id);
end;
$$;

create or replace function public.unpublish_results(p_class uuid)
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
  if not public.has_org_permission(v_class.organization_id, 'result.unpublish') then
    raise exception 'Missing permission: result.unpublish';
  end if;
  if v_class.status <> 'results_posted' then
    return;
  end if;

  update public.classes set status = 'official' where id = p_class;

  perform public.log_audit(v_class.organization_id, 'results.unposted', 'class', p_class::text,
    jsonb_build_object('status', 'results_posted'), jsonb_build_object('status', 'official'),
    null, v_class.show_id);
end;
$$;

-- ------------------------------------------------------------
-- 00011_payouts_rule_packages.sql — payouts (class-scoped; rule
-- package status changes remain org-level and are untouched)
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

  v_pool_cents := round(v_pool_cents * (1 - v_class.retainage_percent / 100.0));

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
    null, jsonb_build_object('pool_cents', v_pool_cents, 'retainage_percent', v_class.retainage_percent),
    null, v_class.show_id);
end;
$$;

create or replace function public.approve_payouts(p_class uuid)
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
  if not public.has_org_permission(v_class.organization_id, 'payout.approve') then
    raise exception 'Missing permission: payout.approve';
  end if;

  perform public.log_audit(v_class.organization_id, 'payout.approved', 'class', p_class::text,
    null, null, null, v_class.show_id);
end;
$$;

-- ------------------------------------------------------------
-- 00014_exhibitor_access.sql — exhibitor self-scratch
-- ------------------------------------------------------------

create or replace function public.exhibitor_scratch_entry_class(
  p_entry_class uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select ec.*, c.class_number, e.rider_person_id, e.owner_person_id, s.status as show_status
  into v_row
  from public.entry_classes ec
  join public.classes c on c.id = ec.class_id
  join public.entries e on e.id = ec.entry_id
  join public.shows s on s.id = ec.show_id
  where ec.id = p_entry_class;

  if v_row is null then
    raise exception 'Entry class not found';
  end if;
  if not (public.is_own_person(v_row.rider_person_id) or public.is_own_person(v_row.owner_person_id)) then
    raise exception 'Not your entry';
  end if;
  if v_row.show_status <> 'published' then
    raise exception 'This show is no longer open for self-service changes — contact the show office';
  end if;
  if v_row.status = 'scratched' then
    return;
  end if;

  update public.entry_classes
  set status = 'scratched', scratch_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_entry_class;

  perform public.log_audit(v_row.organization_id, 'entry.class_scratched', 'entry_class', p_entry_class::text,
    jsonb_build_object('entry_id', v_row.entry_id, 'class', v_row.class_number, 'status', 'entered'),
    jsonb_build_object('status', 'scratched'),
    coalesce(p_reason, 'Scratched by exhibitor'), v_row.show_id);
end;
$$;
