-- ============================================================
-- ShowRing IQ — Sprint 9: Results
-- Placings calculated from verified/official scores. Tie handling
-- v1 is "ties stand" (standard competition ranking: 1,2,2,4 — the
-- rule package will later add split money / run-off / co-champions).
-- Public results page and PDF generation are deferred per CLAUDE.md's
-- MVP scope; PDFs arrive with the Sprint 10 NRHA package.
-- ============================================================

create table public.results (
  id uuid primary key default gen_random_uuid(),
  entry_class_id uuid not null unique references public.entry_classes (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  placing integer check (placing > 0),
  tie_status text not null default 'none' check (tie_status in ('none', 'tied')),
  money_won_cents integer not null default 0 check (money_won_cents >= 0),
  manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index results_class_idx on public.results (class_id, placing);

alter table public.results enable row level security;

create trigger results_set_updated_at
  before update on public.results
  for each row execute function public.set_updated_at();

create policy "results_select_permitted" on public.results
  for select to authenticated
  using (public.has_org_permission(organization_id, 'result.view'));

revoke insert, update, delete on public.results from authenticated;

-- ------------------------------------------------------------
-- RPC: calculate placings for a class
-- Ranks entered, non-manually-overridden entries with a verified
-- 'shown'/'zero' score, higher total_score_tenths wins. Entries
-- without a countable score get placing = null.
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
  insert into public.results (entry_class_id, class_id, show_id, organization_id, placing, tie_status)
  select r.entry_class_id, p_class, v_class.show_id, v_class.organization_id,
         r.computed_placing, case when r.tie_count > 1 then 'tied' else 'none' end
  from ranked r
  on conflict (entry_class_id) do update set
    placing = excluded.placing,
    tie_status = excluded.tie_status,
    updated_at = now()
  where public.results.manual_override = false;

  insert into public.results (entry_class_id, class_id, show_id, organization_id, placing, tie_status)
  select ec.id, p_class, v_class.show_id, v_class.organization_id, null, 'none'
  from public.entry_classes ec
  left join public.scores s on s.entry_class_id = ec.id
  where ec.class_id = p_class and ec.status = 'entered'
    and not (
      s.result_status in ('shown', 'zero') and s.total_score_tenths is not null
    )
  on conflict (entry_class_id) do update set
    placing = null, tie_status = 'none', updated_at = now()
  where public.results.manual_override = false;

  perform public.log_audit(v_class.organization_id, 'results.calculated', 'class', p_class::text,
    null, jsonb_build_object('class_number', v_class.class_number));
end;
$$;

-- ------------------------------------------------------------
-- RPC: manually override one entry's placing (placing_correction)
-- ------------------------------------------------------------

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

  insert into public.results (entry_class_id, class_id, show_id, organization_id, placing, manual_override)
  values (p_entry_class, v_ec.class_id, v_ec.show_id, v_ec.organization_id, p_placing, true)
  on conflict (entry_class_id) do update set
    placing = p_placing, manual_override = true, updated_at = now();

  perform public.log_audit(v_class.organization_id, 'result.placing_corrected', 'result', p_entry_class::text,
    jsonb_build_object('placing', v_old.placing, 'correction_type', 'placing_correction'),
    jsonb_build_object('placing', p_placing),
    p_reason);
end;
$$;

-- ------------------------------------------------------------
-- RPC: publish / unpublish results (class-level)
-- ------------------------------------------------------------

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
    jsonb_build_object('status', 'official'), jsonb_build_object('status', 'results_posted'));
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
    jsonb_build_object('status', 'results_posted'), jsonb_build_object('status', 'official'));
end;
$$;

revoke execute on function public.calculate_results(uuid) from anon;
revoke execute on function public.override_placing(uuid, integer, text) from anon;
revoke execute on function public.publish_results(uuid) from anon;
revoke execute on function public.unpublish_results(uuid) from anon;
