-- ============================================================
-- ShowRing IQ — Sprint 8: Scoring
-- One score row per entry_class. Scores are stored as tenths of a
-- point (integer) — never floats — mirroring the money-as-cents rule.
-- Lifecycle: pending -> submitted (judge signs) -> verified (secretary).
-- After verification, changes must go through correct_score with a
-- reason (judge_sheet_correction / data_entry_correction).
--
-- Known simplification: there is no class_judges assignment table yet,
-- so any user holding score.enter can pick which judge they're entering
-- for. Per-judge visibility restrictions (a judge shouldn't see another
-- judge's pre-submission score) are not enforced yet — noted for a
-- later sprint once class_judges exists.
-- ============================================================

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  entry_class_id uuid not null unique references public.entry_classes (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  judge_staff_id uuid references public.show_staff (id) on delete set null,
  judge_name text,
  result_status text not null default 'shown' check (result_status in ('shown', 'zero', 'no_score', 'dq', 'excused')),
  total_score_tenths integer,
  penalty_points_tenths integer not null default 0 check (penalty_points_tenths >= 0),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'verified')),
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id),
  verified_at timestamptz,
  verified_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scores_result_status_consistency check (
    (result_status = 'shown' and total_score_tenths is not null)
    or (result_status = 'zero' and total_score_tenths = 0)
    or (result_status in ('no_score', 'dq', 'excused') and total_score_tenths is null)
  )
);

create index scores_class_idx on public.scores (class_id);

alter table public.scores enable row level security;

create trigger scores_set_updated_at
  before update on public.scores
  for each row execute function public.set_updated_at();

create or replace function public.scores_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select ec.class_id, ec.show_id, ec.organization_id
  into new.class_id, new.show_id, new.organization_id
  from public.entry_classes ec where ec.id = new.entry_class_id;
  if new.organization_id is null then
    raise exception 'Entry class not found';
  end if;
  return new;
end;
$$;

create trigger scores_before_insert
  before insert on public.scores
  for each row execute function public.scores_before_insert();

-- Reads only; every write happens through the RPCs below.
create policy "scores_select_permitted" on public.scores
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

revoke insert, update, delete on public.scores from authenticated;

-- ------------------------------------------------------------
-- Helper: validate result_status/total_score_tenths pairing with a
-- friendly error instead of a raw constraint violation.
-- ------------------------------------------------------------

create or replace function public.validate_score_consistency(
  p_result_status text,
  p_total_score_tenths integer
)
returns void
language plpgsql
as $$
begin
  if p_result_status = 'shown' and p_total_score_tenths is null then
    raise exception 'Enter a total score, or choose a different result status';
  end if;
  if p_result_status = 'zero' and coalesce(p_total_score_tenths, 0) <> 0 then
    raise exception 'A zero score must have a total score of 0';
  end if;
  if p_result_status in ('no_score', 'dq', 'excused') and p_total_score_tenths is not null then
    raise exception '% cannot have a numeric total score', p_result_status;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- RPC: enter/update a score while still pending (judge drafting,
-- or secretary keying from a paper card)
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

  return v_score_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: judge signs/submits a score
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
  if v_score.status <> 'pending' then
    return;
  end if;

  update public.scores
  set status = 'submitted', submitted_at = now(), submitted_by = (select auth.uid())
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.submitted', 'score', v_score.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'submitted', 'total_score_tenths', v_score.total_score_tenths,
                       'result_status', v_score.result_status));
end;
$$;

-- ------------------------------------------------------------
-- RPC: secretary verifies a submitted score
-- ------------------------------------------------------------

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
end;
$$;

-- ------------------------------------------------------------
-- RPC: send a score back a step (e.g. judge wants to re-open before
-- verification, or secretary sends a verified score back for review)
-- ------------------------------------------------------------

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

  update public.scores set status = v_new_status where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.reopened', 'score', v_score.id::text,
    jsonb_build_object('status', v_score.status),
    jsonb_build_object('status', v_new_status),
    p_reason);
end;
$$;

-- ------------------------------------------------------------
-- RPC: correct a score (any lifecycle stage). Corrections after
-- verification require score.correct_official; before that,
-- score.edit_unofficial. A reason is always required.
-- ------------------------------------------------------------

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
end;
$$;

-- ------------------------------------------------------------
-- RPC: mark a class's scoring complete / official
-- ------------------------------------------------------------

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
    jsonb_build_object('status', v_class.status), jsonb_build_object('status', 'pending_verification'));
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
    jsonb_build_object('status', 'pending_verification'), jsonb_build_object('status', 'official'));
end;
$$;

revoke execute on function public.enter_score(uuid, text, integer, uuid, integer, text) from anon;
revoke execute on function public.submit_score(uuid) from anon;
revoke execute on function public.verify_score(uuid) from anon;
revoke execute on function public.reopen_score(uuid, text) from anon;
revoke execute on function public.correct_score(uuid, text, text, integer, integer, text, text) from anon;
revoke execute on function public.mark_class_scoring_complete(uuid) from anon;
revoke execute on function public.mark_class_official(uuid) from anon;
