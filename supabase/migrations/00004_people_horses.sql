-- ============================================================
-- ShowRing IQ — Sprint 4: People & horses
-- Org-level master database: riders/owners/trainers, horses,
-- association memberships, registrations/licenses, ownerships.
-- Leases, documents, and duplicate detection come later.
-- ============================================================

-- ------------------------------------------------------------
-- People
-- ------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  preferred_name text,
  email text,
  phone text,
  city text,
  state text,
  birthdate date,
  roles text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_roles_valid check (
    roles <@ array['rider', 'owner', 'trainer', 'agent', 'parent_guardian', 'judge']::text[]
  )
);

create index people_org_name_idx on public.people (organization_id, last_name, first_name);

alter table public.people enable row level security;

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Person association memberships (NRHA number, AQHA number, …)
-- ------------------------------------------------------------

create table public.person_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  association text not null check (char_length(association) between 2 and 40),
  membership_number text not null check (char_length(membership_number) between 1 and 40),
  membership_type text,
  status text not null default 'unknown' check (status in ('active', 'expired', 'pending', 'unknown')),
  effective_date date,
  expiration_date date,
  verified_at timestamptz,
  verified_source text,
  notes text,
  created_at timestamptz not null default now()
);

create index person_memberships_person_idx on public.person_memberships (person_id);

alter table public.person_memberships enable row level security;

create or replace function public.person_children_set_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id
  from public.people where id = new.person_id;
  if new.organization_id is null then
    raise exception 'Person not found';
  end if;
  return new;
end;
$$;

create trigger person_memberships_set_org
  before insert or update of person_id on public.person_memberships
  for each row execute function public.person_children_set_org();

-- ------------------------------------------------------------
-- Horses
-- ------------------------------------------------------------

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  registered_name text not null check (char_length(registered_name) between 2 and 120),
  barn_name text,
  breed text,
  sex text check (sex in ('mare', 'gelding', 'stallion')),
  color text,
  foal_year integer check (foal_year between 1980 and 2100),
  sire text,
  dam text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index horses_org_name_idx on public.horses (organization_id, registered_name);

alter table public.horses enable row level security;

create trigger horses_set_updated_at
  before update on public.horses
  for each row execute function public.set_updated_at();

-- Shared org-sync trigger for tables keyed by horse_id
create or replace function public.horse_children_set_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id
  from public.horses where id = new.horse_id;
  if new.organization_id is null then
    raise exception 'Horse not found';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Horse association registrations / competition licenses
-- ------------------------------------------------------------

create table public.horse_registrations (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  association text not null check (char_length(association) between 2 and 40),
  registration_number text,
  competition_license_number text,
  status text not null default 'unknown' check (status in ('active', 'expired', 'pending', 'unknown')),
  expiration_date date,
  verified_at timestamptz,
  verified_source text,
  notes text,
  created_at timestamptz not null default now(),
  constraint horse_registrations_has_number check (
    registration_number is not null or competition_license_number is not null
  )
);

create index horse_registrations_horse_idx on public.horse_registrations (horse_id);

alter table public.horse_registrations enable row level security;

create trigger horse_registrations_set_org
  before insert or update of horse_id on public.horse_registrations
  for each row execute function public.horse_children_set_org();

-- ------------------------------------------------------------
-- Horse ownerships (link to people; percentages for co-ownership)
-- ------------------------------------------------------------

create table public.horse_ownerships (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_person_id uuid not null references public.people (id) on delete cascade,
  percentage integer not null default 100 check (percentage between 1 and 100),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (horse_id, owner_person_id)
);

create index horse_ownerships_horse_idx on public.horse_ownerships (horse_id);

alter table public.horse_ownerships enable row level security;

create trigger horse_ownerships_set_org
  before insert or update of horse_id on public.horse_ownerships
  for each row execute function public.horse_children_set_org();

-- ------------------------------------------------------------
-- RLS
-- Reads require org.view (owners, managers, secretaries,
-- assistants, treasurers — not judges/gate/announcer, keeping
-- birthdates and contact info minimally exposed).
-- ------------------------------------------------------------

-- people
create policy "people_select_permitted" on public.people
  for select to authenticated
  using (public.has_org_permission(organization_id, 'org.view'));

create policy "people_insert_permitted" on public.people
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'person.create'));

create policy "people_update_permitted" on public.people
  for update to authenticated
  using (public.has_org_permission(organization_id, 'person.edit'))
  with check (public.has_org_permission(organization_id, 'person.edit'));

create policy "people_delete_permitted" on public.people
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'person.edit'));

-- person_memberships
create policy "person_memberships_select_permitted" on public.person_memberships
  for select to authenticated
  using (public.has_org_permission(organization_id, 'org.view'));

create policy "person_memberships_write_permitted" on public.person_memberships
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'membership.edit'));

create policy "person_memberships_update_permitted" on public.person_memberships
  for update to authenticated
  using (public.has_org_permission(organization_id, 'membership.edit'))
  with check (public.has_org_permission(organization_id, 'membership.edit'));

create policy "person_memberships_delete_permitted" on public.person_memberships
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'membership.edit'));

-- horses
create policy "horses_select_permitted" on public.horses
  for select to authenticated
  using (public.has_org_permission(organization_id, 'org.view'));

create policy "horses_insert_permitted" on public.horses
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'horse.create'));

create policy "horses_update_permitted" on public.horses
  for update to authenticated
  using (public.has_org_permission(organization_id, 'horse.edit'))
  with check (public.has_org_permission(organization_id, 'horse.edit'));

create policy "horses_delete_permitted" on public.horses
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'horse.edit'));

-- horse_registrations
create policy "horse_registrations_select_permitted" on public.horse_registrations
  for select to authenticated
  using (public.has_org_permission(organization_id, 'org.view'));

create policy "horse_registrations_insert_permitted" on public.horse_registrations
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'membership.edit'));

create policy "horse_registrations_update_permitted" on public.horse_registrations
  for update to authenticated
  using (public.has_org_permission(organization_id, 'membership.edit'))
  with check (public.has_org_permission(organization_id, 'membership.edit'));

create policy "horse_registrations_delete_permitted" on public.horse_registrations
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'membership.edit'));

-- horse_ownerships
create policy "horse_ownerships_select_permitted" on public.horse_ownerships
  for select to authenticated
  using (public.has_org_permission(organization_id, 'org.view'));

create policy "horse_ownerships_insert_permitted" on public.horse_ownerships
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'ownership.edit'));

create policy "horse_ownerships_update_permitted" on public.horse_ownerships
  for update to authenticated
  using (public.has_org_permission(organization_id, 'ownership.edit'))
  with check (public.has_org_permission(organization_id, 'ownership.edit'));

create policy "horse_ownerships_delete_permitted" on public.horse_ownerships
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'ownership.edit'));
