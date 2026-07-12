-- ============================================================
-- ShowRing IQ — Multi-judge scoring
--
-- Today scores holds exactly one score per run (entry_class_id is
-- UNIQUE). At NRHA events with more than one judge chair, each judge
-- scores independently and the run's official score is the average.
-- Rather than changing scores' shape (which results calculation, the
-- NRHA export, and payouts all read from), this adds a companion table
-- that holds each judge's individual call. Once every judge assigned to
-- the class (class_judges) has recorded a score for a run, the RPC
-- computes the average and writes/updates the ordinary `scores` row —
-- so every downstream consumer keeps working unchanged. Classes with 0
-- or 1 assigned judges are completely unaffected; this table stays
-- empty for them and the existing enter_score path is untouched.
--
-- v1 scope: numeric "shown" scores only. A judge calling a no-score/DQ/
-- excused on a multi-judge run is out of scope — the office resolves
-- that with a manual correction on the composite score, same as any
-- other unusual case today.
-- ============================================================

create table public.score_judges (
  id uuid primary key default gen_random_uuid(),
  entry_class_id uuid not null references public.entry_classes (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  judge_staff_id uuid not null references public.show_staff (id) on delete cascade,
  total_score_tenths integer not null check (total_score_tenths >= 0),
  penalty_points_tenths integer not null default 0 check (penalty_points_tenths >= 0),
  notes text,
  submitted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_class_id, judge_staff_id)
);

comment on table public.score_judges is
  'One row per judge per run for multi-judge (chair) scoring. The '
  'composite score in public.scores is the average, written once every '
  'assigned judge has recorded a score — see enter_judge_score().';

create index score_judges_entry_class_idx on public.score_judges (entry_class_id);
create index score_judges_class_idx on public.score_judges (class_id);

alter table public.score_judges enable row level security;

create policy "score_judges_select_permitted" on public.score_judges
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

revoke insert, update, delete on public.score_judges from authenticated;

create trigger score_judges_set_updated_at
  before update on public.score_judges
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RPC: record one judge's score for a run. Once every judge assigned
-- to the class has a row, computes the average and upserts the
-- composite public.scores row via the same path enter_score uses.
-- ------------------------------------------------------------

create or replace function public.enter_judge_score(
  p_entry_class uuid,
  p_judge_staff_id uuid,
  p_total_score_tenths integer,
  p_penalty_points_tenths integer default 0,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ec record;
  v_assigned_count integer;
  v_recorded_count integer;
  v_avg_tenths integer;
  v_judge_names text;
  v_existing_score record;
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
  if p_total_score_tenths is null or p_total_score_tenths < 0 then
    raise exception 'A score is required';
  end if;

  if not exists (
    select 1 from public.class_judges
    where class_id = v_ec.class_id and show_staff_id = p_judge_staff_id
  ) then
    raise exception 'That judge is not assigned to this class';
  end if;

  select * into v_existing_score from public.scores where entry_class_id = p_entry_class;
  if v_existing_score is not null and v_existing_score.status <> 'pending' then
    raise exception 'Score has already been submitted; use a correction instead';
  end if;

  insert into public.score_judges (
    entry_class_id, class_id, show_id, organization_id, judge_staff_id,
    total_score_tenths, penalty_points_tenths, notes, submitted_by
  )
  values (
    p_entry_class, v_ec.class_id, v_ec.show_id, v_ec.organization_id, p_judge_staff_id,
    p_total_score_tenths, coalesce(p_penalty_points_tenths, 0), p_notes, (select auth.uid())
  )
  on conflict (entry_class_id, judge_staff_id) do update set
    total_score_tenths = excluded.total_score_tenths,
    penalty_points_tenths = excluded.penalty_points_tenths,
    notes = excluded.notes,
    submitted_by = excluded.submitted_by;

  select count(*) into v_assigned_count
  from public.class_judges where class_id = v_ec.class_id;
  select count(*) into v_recorded_count
  from public.score_judges where entry_class_id = p_entry_class;

  -- Not every assigned judge has weighed in yet — leave the composite
  -- score alone (it doesn't exist yet, or is still mid-entry).
  if v_recorded_count < v_assigned_count then
    return;
  end if;

  select round(avg(total_score_tenths))::integer into v_avg_tenths
  from public.score_judges where entry_class_id = p_entry_class;

  select string_agg(s.display_name, ', ' order by s.display_name)
  into v_judge_names
  from public.score_judges sj
  join public.show_staff s on s.id = sj.judge_staff_id
  where sj.entry_class_id = p_entry_class;

  if v_existing_score is null then
    insert into public.scores (
      entry_class_id, class_id, show_id, organization_id, judge_staff_id, judge_name,
      result_status, total_score_tenths, penalty_points_tenths, notes
    )
    values (
      p_entry_class, v_ec.class_id, v_ec.show_id, v_ec.organization_id, null,
      format('%s judges (avg): %s', v_assigned_count, v_judge_names),
      'shown', v_avg_tenths, 0,
      format('Average of %s judge scores.', v_assigned_count)
    );
  else
    update public.scores set
      judge_staff_id = null,
      judge_name = format('%s judges (avg): %s', v_assigned_count, v_judge_names),
      result_status = 'shown',
      total_score_tenths = v_avg_tenths,
      penalty_points_tenths = 0,
      notes = format('Average of %s judge scores.', v_assigned_count)
    where entry_class_id = p_entry_class;
  end if;
end;
$$;

revoke execute on function public.enter_judge_score(uuid, uuid, integer, integer, text) from anon;
