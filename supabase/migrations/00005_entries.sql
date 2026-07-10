-- ============================================================
-- ShowRing IQ — Sprint 5: Entries & back numbers
-- Entries link riders/horses/owners to shows; entry_classes hold
-- per-class fee snapshots and scratch status (scratched rows are
-- kept — NRHA CSVs must still include them with score -2).
-- Back numbers are unique per show and only move via audited RPCs.
-- ============================================================

-- ------------------------------------------------------------
-- Entries
-- Rider/horse/owner/trainer names are snapshotted for display:
-- gate/announcer staff can see entries (show.view) without read
-- access to the people table (org.view), and printed programs
-- shouldn't change if a profile is edited mid-show.
-- ------------------------------------------------------------

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_number integer not null,
  rider_person_id uuid not null references public.people (id) on delete restrict,
  horse_id uuid not null references public.horses (id) on delete restrict,
  owner_person_id uuid references public.people (id) on delete set null,
  trainer_person_id uuid references public.people (id) on delete set null,
  rider_name text not null,
  horse_name text not null,
  owner_name text,
  trainer_name text,
  status text not null default 'active' check (status in ('active', 'scratched')),
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, entry_number)
);

create index entries_show_idx on public.entries (show_id, entry_number);
create index entries_rider_idx on public.entries (rider_person_id);
create index entries_horse_idx on public.entries (horse_id);

alter table public.entries enable row level security;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

create or replace function public.entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id
  from public.shows where id = new.show_id;
  if new.organization_id is null then
    raise exception 'Show not found';
  end if;
  if new.entry_number is null or new.entry_number <= 0 then
    select coalesce(max(entry_number), 0) + 1 into new.entry_number
    from public.entries where show_id = new.show_id;
  end if;
  new.created_by := (select auth.uid());
  return new;
end;
$$;

create trigger entries_before_insert
  before insert on public.entries
  for each row execute function public.entries_before_insert();

-- ------------------------------------------------------------
-- Entry classes (fee snapshot at time of add; scratches keep rows)
-- ------------------------------------------------------------

create table public.entry_classes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  status text not null default 'entered' check (status in ('entered', 'scratched')),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  scratch_reason text,
  created_at timestamptz not null default now(),
  unique (entry_id, class_id)
);

create index entry_classes_entry_idx on public.entry_classes (entry_id);
create index entry_classes_class_idx on public.entry_classes (class_id);

alter table public.entry_classes enable row level security;

create or replace function public.entry_classes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_show uuid;
begin
  select organization_id, show_id into new.organization_id, new.show_id
  from public.entries where id = new.entry_id;
  if new.organization_id is null then
    raise exception 'Entry not found';
  end if;
  select show_id into v_class_show from public.classes where id = new.class_id;
  if v_class_show is null or v_class_show <> new.show_id then
    raise exception 'Class does not belong to this show';
  end if;
  return new;
end;
$$;

create trigger entry_classes_before_insert
  before insert on public.entry_classes
  for each row execute function public.entry_classes_before_insert();

-- ------------------------------------------------------------
-- Back numbers (unique per show; writes via RPC only)
-- ------------------------------------------------------------

create table public.back_numbers (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null check (number between 1 and 9999),
  entry_id uuid not null references public.entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (show_id, number),
  unique (entry_id)
);

alter table public.back_numbers enable row level security;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

create policy "entries_select_permitted" on public.entries
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "entries_insert_permitted" on public.entries
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'entry.create')
    and public.show_is_editable(show_id)
  );

create policy "entries_update_permitted" on public.entries
  for update to authenticated
  using (
    public.has_org_permission(organization_id, 'entry.edit')
    and public.show_is_editable(show_id)
  )
  with check (
    public.has_org_permission(organization_id, 'entry.edit')
    and public.show_is_editable(show_id)
  );

create policy "entries_delete_permitted" on public.entries
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'entry.delete')
    and public.show_is_editable(show_id)
  );

-- entry status only changes via scratch/reinstate RPCs; entry_number is
-- trigger-assigned
revoke insert, update on public.entries from authenticated;
grant insert (show_id, rider_person_id, horse_id, owner_person_id,
              trainer_person_id, rider_name, horse_name, owner_name,
              trainer_name, notes)
  on public.entries to authenticated;
grant update (owner_person_id, trainer_person_id, owner_name, trainer_name, notes)
  on public.entries to authenticated;

create policy "entry_classes_select_permitted" on public.entry_classes
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "entry_classes_insert_permitted" on public.entry_classes
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'entry.edit')
    and public.show_is_editable(show_id)
  );

create policy "entry_classes_delete_permitted" on public.entry_classes
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'entry.edit')
    and public.show_is_editable(show_id)
    and status = 'entered'
  );

-- status/scratch_reason only change via RPCs
revoke update on public.entry_classes from authenticated;
revoke insert on public.entry_classes from authenticated;
grant insert (entry_id, class_id, fee_cents) on public.entry_classes to authenticated;

create policy "back_numbers_select_permitted" on public.back_numbers
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

-- back numbers move only via RPCs
revoke insert, update, delete on public.back_numbers from authenticated;

-- ------------------------------------------------------------
-- RPC: assign / transfer a back number
-- p_number null = auto-assign next available for the show
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
      jsonb_build_object('entry_id', p_entry, 'number', v_num));
  else
    insert into public.back_numbers (show_id, organization_id, number, entry_id)
    values (v_entry.show_id, v_entry.organization_id, v_num, p_entry);
    perform public.log_audit(v_entry.organization_id, 'back_number.assigned', 'back_number', null,
      null, jsonb_build_object('entry_id', p_entry, 'number', v_num));
  end if;

  return v_num;
end;
$$;

-- ------------------------------------------------------------
-- RPC: release a back number
-- ------------------------------------------------------------

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
    jsonb_build_object('entry_id', p_entry, 'number', v_existing.number), null);
end;
$$;

-- ------------------------------------------------------------
-- RPC: scratch / reinstate one entry-class
-- ------------------------------------------------------------

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
    p_reason);
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
    jsonb_build_object('status', 'entered'));
end;
$$;

-- ------------------------------------------------------------
-- RPC: scratch a whole entry (entry + all entered classes)
-- ------------------------------------------------------------

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
    p_reason);
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
    jsonb_build_object('status', 'active'));
end;
$$;

revoke execute on function public.assign_back_number(uuid, integer) from anon;
revoke execute on function public.release_back_number(uuid) from anon;
revoke execute on function public.scratch_entry_class(uuid, text) from anon;
revoke execute on function public.reinstate_entry_class(uuid) from anon;
revoke execute on function public.scratch_entry(uuid, text) from anon;
revoke execute on function public.reinstate_entry(uuid) from anon;
