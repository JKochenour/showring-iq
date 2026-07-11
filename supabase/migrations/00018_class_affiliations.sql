-- ============================================================
-- ShowRing IQ — class_affiliations
-- Closes the gap noted in CLAUDE.md's data model and in
-- 00012_class_rule_codes.sql: a class could only link to ONE
-- association_class_codes row via classes.class_code_id, so a class
-- that counts for two associations at once (e.g. Class 12 "Green
-- Reiner Level 1" -> NRHA code 5300 for money+points, and a separate
-- EPRHA code for year-end) had no way to model the second code,
-- rules, or export behavior.
--
-- Design: classes.class_code_id is kept as the legacy/primary
-- pointer (existing reads/writes keep working unchanged) and this
-- migration backfills every non-null class_code_id into a
-- class_affiliations row with is_primary = true, so it immediately
-- shows up wherever the new table is read. Going forward,
-- class_affiliations is the source of truth for multi-affiliation
-- classes; class_code_id continues to work for single-affiliation
-- classes and as a fallback where class_affiliations has no rows.
--
-- counts_for_money / counts_for_points mirror the semantics in
-- CLAUDE.md ("NRHA code 5300 counts for money+points; EPRHA code
-- counts for year-end"). counts_for_year_end is a separate flag
-- (year-end awards, not run money/points) since a code can count for
-- one, some, or all three per affiliation.
-- ============================================================

create table public.class_affiliations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  association_class_code_id uuid not null references public.association_class_codes (id) on delete restrict,
  counts_for_money boolean not null default true,
  counts_for_points boolean not null default true,
  counts_for_year_end boolean not null default false,
  -- The affiliation used for legacy single-code reads (class_code_id)
  -- and as the default when a class-scoped feature needs exactly one
  -- affiliation. Enforced unique per class below.
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, association_class_code_id)
);

create index class_affiliations_class_idx on public.class_affiliations (class_id);
create index class_affiliations_code_idx on public.class_affiliations (association_class_code_id);

-- Only one primary affiliation per class.
create unique index class_affiliations_one_primary_idx
  on public.class_affiliations (class_id)
  where is_primary;

alter table public.class_affiliations enable row level security;

create trigger class_affiliations_set_updated_at
  before update on public.class_affiliations
  for each row execute function public.set_updated_at();

-- Sync show_id/organization_id from the class, and validate the
-- linked association_class_codes row belongs to the same org —
-- mirrors classes_check_class_code_org() in 00012_class_rule_codes.sql.
create or replace function public.class_affiliations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
  v_code_org uuid;
begin
  select c.show_id, c.organization_id into v_class
  from public.classes c where c.id = new.class_id;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  new.show_id := v_class.show_id;
  new.organization_id := v_class.organization_id;

  select organization_id into v_code_org
  from public.association_class_codes where id = new.association_class_code_id;
  if v_code_org is null or v_code_org <> new.organization_id then
    raise exception 'Class code does not belong to this organization';
  end if;

  return new;
end;
$$;

create trigger class_affiliations_before_insert
  before insert on public.class_affiliations
  for each row execute function public.class_affiliations_before_insert();

create trigger class_affiliations_before_update
  before update of class_id, association_class_code_id on public.class_affiliations
  for each row execute function public.class_affiliations_before_insert();

-- ------------------------------------------------------------
-- RLS: reads follow show.view (same as classes); writes require
-- class.edit on an unlocked show (same as classes/class_judges).
-- ------------------------------------------------------------

create policy "class_affiliations_select_permitted" on public.class_affiliations
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "class_affiliations_insert_permitted" on public.class_affiliations
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

create policy "class_affiliations_update_permitted" on public.class_affiliations
  for update to authenticated
  using (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  )
  with check (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

create policy "class_affiliations_delete_permitted" on public.class_affiliations
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

revoke insert, update, delete on public.class_affiliations from anon;

-- ------------------------------------------------------------
-- Backfill: every class with a legacy class_code_id gets a matching
-- primary class_affiliations row, so existing single-affiliation
-- classes show up in the new table immediately. counts_for_money /
-- counts_for_points are copied from the linked association_class_codes
-- row (the flags that already governed its behavior); counts_for_year_end
-- defaults to false since nothing tracked that before this migration.
-- ------------------------------------------------------------

insert into public.class_affiliations (
  class_id, show_id, organization_id, association_class_code_id,
  counts_for_money, counts_for_points, counts_for_year_end, is_primary
)
select
  c.id, c.show_id, c.organization_id, c.class_code_id,
  coalesce(acc.counts_for_money, true),
  coalesce(acc.counts_for_points, true),
  false,
  true
from public.classes c
join public.association_class_codes acc on acc.id = c.class_code_id
where c.class_code_id is not null
on conflict (class_id, association_class_code_id) do nothing;
