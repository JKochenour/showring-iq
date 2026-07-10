-- ============================================================
-- ShowRing IQ — Payout engine (v1) + rule-package foundation
--
-- Payouts: a per-class, percent-by-placing schedule (data, not
-- hard-coded formula). "Ties stand" already ranks placings (Sprint 9);
-- money splits the combined percentage of tied placings evenly, the
-- common real-world convention. Retainage defaults to 5% per CLAUDE.md
-- but is stored per-class so it can be corrected before calculating.
-- calculate_payouts is a CALCULATOR, not an approval — the numbers it
-- produces are only as good as the schedule configured, which the show
-- manager must confirm against their fee schedule / association rules
-- before relying on them. There is no verified "the" NRHA formula baked
-- in here.
--
-- Rule packages: the data model CLAUDE.md's architecture principle #2
-- calls for (class code catalogs + eligibility rules as JSON condition
-- objects), scoped per-organization for now rather than a shared
-- platform catalog (there's no platform-admin system built yet). This
-- is foundation only — it is NOT yet wired into the class/entry/
-- eligibility flows built in earlier sprints; classes still use the
-- plain nrha_class_code field from migration 00010.
-- ============================================================

alter table public.shows
  add column medication_fee_cents integer not null default 0 check (medication_fee_cents >= 0);

-- shows has column-level update grants (migration 00002); extend the
-- allowlist so medication_fee_cents can be edited like any other field
grant update (medication_fee_cents) on public.shows to authenticated;

alter table public.classes
  add column retainage_percent numeric(5, 2) not null default 5.00 check (retainage_percent between 0 and 100),
  add column payout_schedule jsonb not null default '[]'::jsonb;

comment on column public.classes.payout_schedule is
  'Array of {"placing": 1, "percent": 30} objects. Example/default only — '
  'the show manager must confirm the schedule before relying on calculated payouts.';

-- ------------------------------------------------------------
-- RPC: calculate payouts for a class from its payout_schedule
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
    null, jsonb_build_object('pool_cents', v_pool_cents, 'retainage_percent', v_class.retainage_percent));
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
    null, null);
end;
$$;

revoke execute on function public.calculate_payouts(uuid) from anon;
revoke execute on function public.approve_payouts(uuid) from anon;

-- ------------------------------------------------------------
-- Rule packages (organization-scoped foundation)
-- ------------------------------------------------------------

create table public.associations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.associations enable row level security;

create table public.association_rule_packages (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  version text not null default '1',
  status text not null default 'draft' check (status in (
    'draft', 'review', 'tested', 'published', 'deprecated', 'archived'
  )),
  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (association_id, year, version)
);

alter table public.association_rule_packages enable row level security;

create trigger association_rule_packages_set_updated_at
  before update on public.association_rule_packages
  for each row execute function public.set_updated_at();

create or replace function public.rule_package_children_set_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id
  from public.association_rule_packages where id = new.rule_package_id;
  if new.organization_id is null then
    raise exception 'Rule package not found';
  end if;
  return new;
end;
$$;

create table public.association_class_codes (
  id uuid primary key default gen_random_uuid(),
  rule_package_id uuid not null references public.association_rule_packages (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 20),
  name text not null check (char_length(name) between 2 and 160),
  discipline text,
  division text,
  is_youth boolean not null default false,
  is_amateur boolean not null default false,
  is_open boolean not null default false,
  is_non_pro boolean not null default false,
  counts_for_points boolean not null default true,
  counts_for_money boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (rule_package_id, code)
);

alter table public.association_class_codes enable row level security;

create trigger association_class_codes_set_org
  before insert or update of rule_package_id on public.association_class_codes
  for each row execute function public.rule_package_children_set_org();

create table public.association_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  rule_package_id uuid not null references public.association_rule_packages (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_key text not null check (char_length(rule_key) between 2 and 80),
  applies_to text[] not null default '{}',
  conditions jsonb not null default '[]'::jsonb,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'blocking', 'critical')),
  message text not null,
  created_at timestamptz not null default now(),
  unique (rule_package_id, rule_key)
);

alter table public.association_eligibility_rules enable row level security;

create trigger association_eligibility_rules_set_org
  before insert or update of rule_package_id on public.association_eligibility_rules
  for each row execute function public.rule_package_children_set_org();

-- ------------------------------------------------------------
-- RLS: reads follow rules.view; writes follow rules.create/edit/publish
-- ------------------------------------------------------------

create policy "associations_select_permitted" on public.associations
  for select to authenticated using (public.has_org_permission(organization_id, 'rules.view'));
create policy "associations_insert_permitted" on public.associations
  for insert to authenticated with check (public.has_org_permission(organization_id, 'rules.create'));
create policy "associations_delete_permitted" on public.associations
  for delete to authenticated using (public.has_org_permission(organization_id, 'rules.edit'));

create policy "rule_packages_select_permitted" on public.association_rule_packages
  for select to authenticated using (public.has_org_permission(organization_id, 'rules.view'));
create policy "rule_packages_insert_permitted" on public.association_rule_packages
  for insert to authenticated with check (public.has_org_permission(organization_id, 'rules.create'));
create policy "rule_packages_update_permitted" on public.association_rule_packages
  for update to authenticated
  using (public.has_org_permission(organization_id, 'rules.edit'))
  with check (public.has_org_permission(organization_id, 'rules.edit'));
create policy "rule_packages_delete_permitted" on public.association_rule_packages
  for delete to authenticated using (public.has_org_permission(organization_id, 'rules.edit'));

create policy "class_codes_select_permitted" on public.association_class_codes
  for select to authenticated using (public.has_org_permission(organization_id, 'rules.view'));
create policy "class_codes_insert_permitted" on public.association_class_codes
  for insert to authenticated with check (public.has_org_permission(organization_id, 'rules.create'));
create policy "class_codes_update_permitted" on public.association_class_codes
  for update to authenticated
  using (public.has_org_permission(organization_id, 'rules.edit'))
  with check (public.has_org_permission(organization_id, 'rules.edit'));
create policy "class_codes_delete_permitted" on public.association_class_codes
  for delete to authenticated using (public.has_org_permission(organization_id, 'rules.edit'));

create policy "eligibility_rules_select_permitted" on public.association_eligibility_rules
  for select to authenticated using (public.has_org_permission(organization_id, 'rules.view'));
create policy "eligibility_rules_insert_permitted" on public.association_eligibility_rules
  for insert to authenticated with check (public.has_org_permission(organization_id, 'rules.create'));
create policy "eligibility_rules_update_permitted" on public.association_eligibility_rules
  for update to authenticated
  using (public.has_org_permission(organization_id, 'rules.edit'))
  with check (public.has_org_permission(organization_id, 'rules.edit'));
create policy "eligibility_rules_delete_permitted" on public.association_eligibility_rules
  for delete to authenticated using (public.has_org_permission(organization_id, 'rules.edit'));

-- ------------------------------------------------------------
-- RPC: publish / archive a rule package (draft -> review -> tested ->
-- published -> deprecated -> archived, per CLAUDE.md's lifecycle)
-- ------------------------------------------------------------

create or replace function public.set_rule_package_status(p_package uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pkg record;
  v_valid_next text[];
begin
  select * into v_pkg from public.association_rule_packages where id = p_package;
  if v_pkg is null then
    raise exception 'Rule package not found';
  end if;
  if not public.has_org_permission(v_pkg.organization_id, 'rules.publish') then
    raise exception 'Missing permission: rules.publish';
  end if;

  v_valid_next := case v_pkg.status
    when 'draft' then array['review', 'archived']
    when 'review' then array['tested', 'draft', 'archived']
    when 'tested' then array['published', 'review', 'archived']
    when 'published' then array['deprecated']
    when 'deprecated' then array['archived', 'published']
    when 'archived' then array['draft']
    else array[]::text[]
  end;

  if not (p_status = any(v_valid_next)) then
    raise exception 'Invalid status transition: % -> %', v_pkg.status, p_status;
  end if;

  update public.association_rule_packages set status = p_status where id = p_package;

  perform public.log_audit(v_pkg.organization_id, 'rule_package.status_changed', 'association_rule_package', p_package::text,
    jsonb_build_object('status', v_pkg.status), jsonb_build_object('status', p_status));
end;
$$;

revoke execute on function public.set_rule_package_status(uuid, text) from anon;
