-- ============================================================
-- ShowRing IQ — Self-serve exhibitor join requests
--
-- Until now the ONLY path from a fresh login to exhibitor access was
-- office-initiated (invite_exhibitor -> email -> accept_invite). This
-- adds the other direction: a signed-in user requests access to an
-- org; the office reviews a queue and approves (linking an existing
-- person record, or creating a new one) or declines. The office keeps
-- full control of who links to person records — approval does exactly
-- what accepting an invite does (exhibitor membership + people.user_id
-- claim), just without the email round-trip, since the requester's
-- user id is already known.
-- ============================================================

create table public.exhibitor_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  message text check (char_length(message) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now()
);

-- One live request per user per org; resolved requests stay as history.
create unique index exhibitor_join_requests_one_pending
  on public.exhibitor_join_requests (organization_id, user_id)
  where status = 'pending';

alter table public.exhibitor_join_requests enable row level security;

-- Requesters see their own; the office sees the org's (same permission
-- that gates exhibitor invites). All writes go through the RPCs below.
create policy "join_requests_select" on public.exhibitor_join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_org_permission(organization_id, 'org.members.invite')
  );

revoke insert, update, delete on public.exhibitor_join_requests from authenticated;

-- ------------------------------------------------------------
-- RPC: orgs a signed-in user can request access to — those with at
-- least one published show (same visibility rule as public_org).
-- ------------------------------------------------------------

create or replace function public.public_orgs_directory()
returns table (
  id uuid,
  name text,
  slug text,
  city text,
  state text
)
language sql
security definer
stable
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.city, o.state
  from public.organizations o
  where exists (
    select 1 from public.shows s
    where s.organization_id = o.id and s.status = 'published'
  )
  order by o.name;
$$;

-- ------------------------------------------------------------
-- RPC: file a join request (any signed-in user, for themselves)
-- ------------------------------------------------------------

create or replace function public.request_exhibitor_access(
  p_org uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_email text;
  v_request uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;
  if not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'Organization not found';
  end if;
  if exists (
    select 1 from public.people
    where organization_id = p_org and user_id = v_uid
  ) then
    raise exception 'You already have exhibitor access to this organization';
  end if;
  if exists (
    select 1 from public.exhibitor_join_requests
    where organization_id = p_org and user_id = v_uid and status = 'pending'
  ) then
    raise exception 'You already have a pending request with this organization';
  end if;

  select coalesce(full_name, email), email into v_name, v_email
  from public.profiles where id = v_uid;
  if v_email is null then
    raise exception 'Profile not found';
  end if;

  insert into public.exhibitor_join_requests
    (organization_id, user_id, requester_name, requester_email, message)
  values (p_org, v_uid, v_name, lower(v_email), nullif(trim(p_message), ''))
  returning id into v_request;

  perform public.log_audit(p_org, 'exhibitor.access_requested',
    'exhibitor_join_request', v_request::text,
    null, jsonb_build_object('name', v_name, 'email', lower(v_email)));

  return v_request;
end;
$$;

revoke execute on function public.request_exhibitor_access(uuid, text) from anon;

-- ------------------------------------------------------------
-- RPC: approve — link an existing unclaimed person record, or create
-- a fresh one, then grant exhibitor membership. Mirrors what
-- accept_invite does for the office-initiated flow.
-- ------------------------------------------------------------

create or replace function public.approve_join_request(
  p_request uuid,
  p_person uuid default null,
  p_first_name text default null,
  p_last_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
  v_role uuid;
  v_person uuid;
begin
  select * into v_req
  from public.exhibitor_join_requests
  where id = p_request and status = 'pending';
  if v_req is null then
    raise exception 'Request not found or not pending';
  end if;
  if not public.has_org_permission(v_req.organization_id, 'org.members.invite') then
    raise exception 'Missing permission: org.members.invite';
  end if;

  if p_person is not null then
    -- Link an existing person record (must be this org's, unclaimed).
    if not exists (
      select 1 from public.people
      where id = p_person and organization_id = v_req.organization_id
    ) then
      raise exception 'Person not found in this organization';
    end if;
    if exists (
      select 1 from public.people where id = p_person and user_id is not null
    ) then
      raise exception 'That person is already linked to a login';
    end if;
    update public.people set user_id = v_req.user_id, email = coalesce(email, v_req.requester_email)
    where id = p_person;
    v_person := p_person;
  else
    -- Create a new person record for the requester.
    if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
      raise exception 'Provide a first and last name for the new person record';
    end if;
    insert into public.people
      (organization_id, first_name, last_name, email, roles, user_id)
    values (v_req.organization_id, trim(p_first_name), trim(p_last_name),
            v_req.requester_email, array['rider', 'owner'], v_req.user_id)
    returning id into v_person;
  end if;

  -- Exhibitor membership (skip if they're already a member some other way).
  v_role := public.ensure_exhibitor_role(v_req.organization_id);
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_req.organization_id and user_id = v_req.user_id
  ) then
    insert into public.organization_members (organization_id, user_id, role_id, status)
    values (v_req.organization_id, v_req.user_id, v_role, 'active');
  end if;

  update public.exhibitor_join_requests
  set status = 'approved', resolved_by = (select auth.uid()), resolved_at = now()
  where id = p_request;

  perform public.log_audit(v_req.organization_id, 'exhibitor.request_approved',
    'exhibitor_join_request', p_request::text,
    null, jsonb_build_object('person_id', v_person, 'email', v_req.requester_email,
                             'linked_existing', p_person is not null));

  return v_person;
end;
$$;

revoke execute on function public.approve_join_request(uuid, uuid, text, text) from anon;

-- ------------------------------------------------------------
-- RPC: decline (reason required — it shows to the requester)
-- ------------------------------------------------------------

create or replace function public.decline_join_request(
  p_request uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
begin
  select * into v_req
  from public.exhibitor_join_requests
  where id = p_request and status = 'pending';
  if v_req is null then
    raise exception 'Request not found or not pending';
  end if;
  if not public.has_org_permission(v_req.organization_id, 'org.members.invite') then
    raise exception 'Missing permission: org.members.invite';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give the requester a reason';
  end if;

  update public.exhibitor_join_requests
  set status = 'declined', decline_reason = trim(p_reason),
      resolved_by = (select auth.uid()), resolved_at = now()
  where id = p_request;

  perform public.log_audit(v_req.organization_id, 'exhibitor.request_declined',
    'exhibitor_join_request', p_request::text,
    null, jsonb_build_object('email', v_req.requester_email, 'reason', trim(p_reason)));
end;
$$;

revoke execute on function public.decline_join_request(uuid, text) from anon;

grant execute on function public.public_orgs_directory() to anon, authenticated;
