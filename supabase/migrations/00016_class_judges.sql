-- ============================================================
-- ShowRing IQ — class_judges assignment table
-- Closes the gap noted in 00008_scoring.sql: previously any org
-- member holding score.enter could enter scores for any class as
-- any judge. This migration adds a class_judges table binding a
-- judge (a show_staff row with staff_role = 'judge') to the
-- specific classes they're assigned to judge, and tightens the
-- scoring RPCs so that a judge-only actor (score.enter without the
-- office-level score.edit_unofficial override) can only act on
-- classes they're assigned to, and only as themselves.
--
-- Office staff (Show Manager, Show Secretary) hold score.enter
-- *and* score.edit_unofficial today, so this change is invisible to
-- them — the restriction only bites when the actor's permission set
-- is judge-shaped (score.enter alone).
-- ============================================================

-- ------------------------------------------------------------
-- class_judges
-- Links a class to the show_staff row for the judge assigned to
-- score it. show_staff already models the person-vs-platform-user
-- distinction (nullable user_id, free-text display_name), so judges
-- without login access can still be assigned/recorded — they just
-- can't be the acting user for the "judge-only" restriction below.
-- ------------------------------------------------------------

create table public.class_judges (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  show_staff_id uuid not null references public.show_staff (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id),
  unique (class_id, show_staff_id)
);

create index class_judges_class_idx on public.class_judges (class_id);
create index class_judges_staff_idx on public.class_judges (show_staff_id);

alter table public.class_judges enable row level security;

-- Sync show_id/organization_id from the class, and validate the
-- assigned show_staff row belongs to the same show and is a judge.
create or replace function public.class_judges_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
  v_staff record;
begin
  select c.show_id, c.organization_id into v_class
  from public.classes c where c.id = new.class_id;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  new.show_id := v_class.show_id;
  new.organization_id := v_class.organization_id;

  select ss.show_id, ss.staff_role into v_staff
  from public.show_staff ss where ss.id = new.show_staff_id;
  if v_staff is null then
    raise exception 'Show staff record not found';
  end if;
  if v_staff.show_id <> new.show_id then
    raise exception 'Judge must be staff on the same show as the class';
  end if;
  if v_staff.staff_role <> 'judge' then
    raise exception 'Assigned staff member must have the judge role';
  end if;

  new.assigned_by := coalesce(new.assigned_by, (select auth.uid()));
  return new;
end;
$$;

create trigger class_judges_before_insert
  before insert on public.class_judges
  for each row execute function public.class_judges_before_insert();

-- ------------------------------------------------------------
-- RLS: reads follow show.view; writes require class.edit (the same
-- permission that already gates class setup — Show Manager) on an
-- editable show, matching classes_insert/update/delete_permitted in
-- 00003_classes.sql.
-- ------------------------------------------------------------

create policy "class_judges_select_permitted" on public.class_judges
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "class_judges_insert_permitted" on public.class_judges
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

create policy "class_judges_delete_permitted" on public.class_judges
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

revoke insert, update, delete on public.class_judges from anon;

-- ------------------------------------------------------------
-- Helper: the show_staff.id of the judge assignment that matches
-- both this class and the calling user, if any. Null if the caller
-- isn't the assigned judge for this class (or isn't a judge at all).
-- ------------------------------------------------------------

create or replace function public.assigned_judge_staff_id(p_class uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cj.show_staff_id
  from public.class_judges cj
  join public.show_staff ss on ss.id = cj.show_staff_id
  where cj.class_id = p_class
    and ss.user_id = (select auth.uid())
  limit 1;
$$;

revoke execute on function public.assigned_judge_staff_id(uuid) from anon;

-- ------------------------------------------------------------
-- Tighten enter_score: a judge-only actor (score.enter without
-- score.edit_unofficial) must be the assigned judge for the class,
-- and can only enter under their own judge_staff_id.
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

  -- Office staff (score.edit_unofficial) may enter/key any judge's
  -- score, as today. Judge-only actors must be the assigned judge
  -- for this class and may only act as themselves.
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

  return v_score_id;
end;
$$;

-- ------------------------------------------------------------
-- Tighten submit_score: a judge-only actor may only submit a score
-- they are the assigned judge for.
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
                       'result_status', v_score.result_status));
end;
$$;

-- ------------------------------------------------------------
-- Tighten reopen_score: the submitted -> pending step uses
-- score.enter, so it's subject to the same judge-assignment check
-- as enter_score/submit_score. The verified -> submitted step uses
-- score.verify, an office-only permission, so it's unaffected.
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
  if v_permission = 'score.enter'
     and not public.has_org_permission(v_score.organization_id, 'score.edit_unofficial')
     and public.assigned_judge_staff_id(v_score.class_id) is null then
    raise exception 'You are not assigned as judge for this class';
  end if;

  update public.scores set status = v_new_status where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.reopened', 'score', v_score.id::text,
    jsonb_build_object('status', v_score.status),
    jsonb_build_object('status', v_new_status),
    p_reason);
end;
$$;

revoke execute on function public.enter_score(uuid, text, integer, uuid, integer, text) from anon;
revoke execute on function public.submit_score(uuid) from anon;
revoke execute on function public.reopen_score(uuid, text) from anon;
