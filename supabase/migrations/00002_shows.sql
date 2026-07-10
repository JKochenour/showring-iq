-- ============================================================
-- ShowRing IQ — Sprint 2: Shows
-- Shows with status lifecycle, show staff assignment.
-- ============================================================

-- ------------------------------------------------------------
-- Shows
-- ------------------------------------------------------------

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'locked', 'archived')),
  start_date date not null,
  end_date date not null,
  timezone text not null default 'America/New_York',
  venue_name text,
  city text,
  state text,
  contact_name text,
  contact_email text,
  contact_phone text,
  description text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (end_date >= start_date)
);

create index shows_org_idx on public.shows (organization_id, start_date desc);

alter table public.shows enable row level security;

create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Show staff
-- A staff row can link an org member (user_id) or be free-text
-- (judges, vets, farriers who aren't platform users yet).
-- ------------------------------------------------------------

create table public.show_staff (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  staff_role text not null check (staff_role in (
    'manager', 'secretary', 'assistant_secretary', 'judge', 'gate',
    'announcer', 'treasurer', 'score_verifier', 'show_representative',
    'steward', 'veterinarian', 'farrier', 'photographer', 'other'
  )),
  notes text,
  created_at timestamptz not null default now()
);

create unique index show_staff_user_role_unique
  on public.show_staff (show_id, user_id, staff_role)
  where user_id is not null;

create index show_staff_show_idx on public.show_staff (show_id);

alter table public.show_staff enable row level security;

-- Keep organization_id in sync with the parent show (RLS relies on it)
create or replace function public.show_staff_set_org()
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
  return new;
end;
$$;

create trigger show_staff_set_org
  before insert or update of show_id on public.show_staff
  for each row execute function public.show_staff_set_org();

-- ------------------------------------------------------------
-- RLS policies
-- ------------------------------------------------------------

create policy "shows_select_permitted" on public.shows
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

-- Inserts and status changes go through RPCs (see below); direct updates
-- are limited to editable columns via column grants and blocked once locked.
create policy "shows_update_permitted" on public.shows
  for update to authenticated
  using (
    public.has_org_permission(organization_id, 'show.edit')
    and status in ('draft', 'published')
  )
  with check (public.has_org_permission(organization_id, 'show.edit'));

create policy "shows_delete_draft_permitted" on public.shows
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'show.delete')
    and status = 'draft'
  );

-- Column-level privileges: status/created_by only change via definer RPCs
revoke insert, update on public.shows from authenticated;
grant update (name, slug, start_date, end_date, timezone, venue_name, city,
              state, contact_name, contact_email, contact_phone, description)
  on public.shows to authenticated;

create policy "show_staff_select_permitted" on public.show_staff
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "show_staff_insert_permitted" on public.show_staff
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'show.edit')
    and exists (
      select 1 from public.shows s
      where s.id = show_id and s.status in ('draft', 'published')
    )
  );

create policy "show_staff_delete_permitted" on public.show_staff
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'show.edit')
    and exists (
      select 1 from public.shows s
      where s.id = show_id and s.status in ('draft', 'published')
    )
  );

-- ------------------------------------------------------------
-- RPC: create show
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
                       'start_date', p_start_date, 'end_date', p_end_date));

  return v_show;
end;
$$;

-- ------------------------------------------------------------
-- RPC: show status transitions
-- draft <-> published (show.publish)
-- published -> locked, locked -> published w/ reason (show.lock)
-- draft/published/locked -> archived, archived -> draft (show.archive)
-- ------------------------------------------------------------

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
    p_reason);
end;
$$;

revoke execute on function public.create_show(uuid, text, text, date, date, text, text, text, text, text) from anon;
revoke execute on function public.set_show_status(uuid, text, text) from anon;
