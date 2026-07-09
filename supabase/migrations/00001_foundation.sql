-- ============================================================
-- ShowRing IQ — Sprint 1: Foundation
-- Tenancy, profiles, organizations, members, roles/permissions,
-- invites, audit log. RLS on every table.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Profiles (mirror of auth.users for app data)
-- ------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Organizations
-- ------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  contact_email text,
  website text,
  city text,
  state text,
  logo_url text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Permission catalog (platform-wide, seeded below)
-- ------------------------------------------------------------

create table public.organization_permissions (
  key text primary key,
  category text not null,
  description text
);

alter table public.organization_permissions enable row level security;

-- ------------------------------------------------------------
-- Roles (per organization, seeded from presets)
-- ------------------------------------------------------------

create table public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

alter table public.organization_roles enable row level security;

create table public.organization_role_permissions (
  role_id uuid not null references public.organization_roles (id) on delete cascade,
  permission_key text not null references public.organization_permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

alter table public.organization_role_permissions enable row level security;

-- ------------------------------------------------------------
-- Members
-- ------------------------------------------------------------

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.organization_roles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.organization_members enable row level security;

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Invites (no email delivery in Sprint 1: invitee sees pending
-- invites matching their login email and accepts in-app)
-- ------------------------------------------------------------

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role_id uuid not null references public.organization_roles (id) on delete cascade,
  invited_by uuid not null references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index organization_invites_pending_unique
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';

alter table public.organization_invites enable row level security;

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  show_id uuid,
  actor_user_id uuid references auth.users (id),
  actor_role text,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip_address inet,
  device_id text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

alter table public.audit_logs enable row level security;

-- ------------------------------------------------------------
-- Authorization helper functions
-- SECURITY DEFINER so RLS policies can call them without
-- recursing into the same tables' policies.
-- ------------------------------------------------------------

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_permission(p_org uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_role_permissions rp on rp.role_id = m.role_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission_key = p_permission
  );
$$;

create or replace function public.is_org_comember(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_user
      and theirs.status = 'active'
  );
$$;

-- Actor's role name in an org (for audit entries)
create or replace function public.org_role_key(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.key
  from public.organization_members m
  join public.organization_roles r on r.id = m.role_id
  where m.organization_id = p_org
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

-- ------------------------------------------------------------
-- RLS policies
-- ------------------------------------------------------------

-- profiles: read self and co-members; update self
create policy "profiles_select_self_or_comember" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_org_comember(id));

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: members read; org.edit updates. Creation via RPC only.
create policy "organizations_select_member" on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy "organizations_update_permitted" on public.organizations
  for update to authenticated
  using (public.has_org_permission(id, 'org.edit'))
  with check (public.has_org_permission(id, 'org.edit'));

-- permission catalog: readable by any signed-in user
create policy "permissions_select_authenticated" on public.organization_permissions
  for select to authenticated
  using (true);

-- roles: members read. Managed via RPC / future role editor.
create policy "roles_select_member" on public.organization_roles
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy "role_permissions_select_member" on public.organization_role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_roles r
      where r.id = role_id and public.is_org_member(r.organization_id)
    )
  );

-- members: members read. All writes via RPCs below.
create policy "members_select_member" on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

-- invites: visible to inviters (org.members.invite) and to the invitee by email
create policy "invites_select_permitted_or_invitee" on public.organization_invites
  for select to authenticated
  using (
    public.has_org_permission(organization_id, 'org.members.invite')
    or lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

-- audit logs: read requires audit.view; writes via definer functions only
create policy "audit_select_permitted" on public.audit_logs
  for select to authenticated
  using (public.has_org_permission(organization_id, 'audit.view'));

-- ------------------------------------------------------------
-- Permission catalog seed
-- ------------------------------------------------------------

insert into public.organization_permissions (key, category, description) values
  -- Organization
  ('org.view', 'organization', 'View organization details'),
  ('org.edit', 'organization', 'Edit organization profile and settings'),
  ('org.billing.manage', 'organization', 'Manage billing'),
  ('org.members.invite', 'organization', 'Invite members'),
  ('org.members.remove', 'organization', 'Remove members'),
  ('org.roles.manage', 'organization', 'Manage roles and member role assignments'),
  -- Shows
  ('show.create', 'shows', 'Create shows'),
  ('show.view', 'shows', 'View shows'),
  ('show.edit', 'shows', 'Edit shows'),
  ('show.delete', 'shows', 'Delete shows'),
  ('show.lock', 'shows', 'Lock/unlock shows'),
  ('show.publish', 'shows', 'Publish shows'),
  ('show.archive', 'shows', 'Archive shows'),
  -- Affiliations
  ('affiliation.add', 'affiliations', 'Add show affiliations'),
  ('affiliation.remove', 'affiliations', 'Remove show affiliations'),
  ('affiliation.configure', 'affiliations', 'Configure show affiliations'),
  ('affiliation.lock', 'affiliations', 'Lock show affiliations'),
  -- Classes
  ('class.create', 'classes', 'Create classes'),
  ('class.edit', 'classes', 'Edit classes'),
  ('class.delete', 'classes', 'Delete classes'),
  ('class.schedule', 'classes', 'Schedule classes'),
  ('class.lock', 'classes', 'Lock classes'),
  ('class.combine', 'classes', 'Combine classes'),
  ('class.split', 'classes', 'Split classes'),
  -- Entries
  ('entry.create', 'entries', 'Create entries'),
  ('entry.edit', 'entries', 'Edit entries'),
  ('entry.delete', 'entries', 'Delete entries'),
  ('entry.scratch', 'entries', 'Scratch entries'),
  ('entry.reinstate', 'entries', 'Reinstate scratched entries'),
  ('entry.assign_back_number', 'entries', 'Assign back numbers'),
  ('entry.check_in', 'entries', 'Check in entries'),
  -- People / horses
  ('person.create', 'people_horses', 'Create people'),
  ('person.edit', 'people_horses', 'Edit people'),
  ('horse.create', 'people_horses', 'Create horses'),
  ('horse.edit', 'people_horses', 'Edit horses'),
  ('ownership.edit', 'people_horses', 'Edit horse ownership/leases'),
  ('membership.edit', 'people_horses', 'Edit association memberships'),
  -- Documents
  ('document.upload', 'documents', 'Upload documents'),
  ('document.verify', 'documents', 'Verify documents'),
  ('document.reject', 'documents', 'Reject documents'),
  ('document.delete', 'documents', 'Delete documents'),
  -- Scoring
  ('score.enter', 'scoring', 'Enter scores'),
  ('score.edit_unofficial', 'scoring', 'Edit unofficial scores'),
  ('score.correct_official', 'scoring', 'Correct official scores'),
  ('score.verify', 'scoring', 'Verify scores'),
  ('score.finalize', 'scoring', 'Finalize scores'),
  ('score.publish', 'scoring', 'Publish scores'),
  -- Results
  ('result.view', 'results', 'View results'),
  ('result.publish', 'results', 'Publish results'),
  ('result.unpublish', 'results', 'Unpublish results'),
  ('result.export', 'results', 'Export results'),
  ('result.submit_package', 'results', 'Generate/submit association packages'),
  -- Financials
  ('invoice.view', 'financials', 'View invoices'),
  ('invoice.edit', 'financials', 'Edit invoices'),
  ('payment.record', 'financials', 'Record payments'),
  ('payment.refund', 'financials', 'Process refunds'),
  ('payout.calculate', 'financials', 'Calculate payouts'),
  ('payout.approve', 'financials', 'Approve payouts'),
  ('financial_reports.view', 'financials', 'View financial reports'),
  -- Reports
  ('report.view', 'reports', 'View reports'),
  ('report.generate', 'reports', 'Generate reports'),
  ('report.export', 'reports', 'Export reports'),
  -- Audit
  ('audit.view', 'audit', 'View audit log'),
  -- Rule packages
  ('rules.view', 'rules', 'View rule packages'),
  ('rules.create', 'rules', 'Create rule packages'),
  ('rules.edit', 'rules', 'Edit rule packages'),
  ('rules.publish', 'rules', 'Publish rule packages');

-- ------------------------------------------------------------
-- Role presets
-- ------------------------------------------------------------

create or replace function public.seed_default_roles(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid;
begin
  -- Organization Owner: every permission
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'organization_owner', 'Organization Owner', 'Full control of the organization', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, key from public.organization_permissions;

  -- Show Manager
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'show_manager', 'Show Manager', 'Show setup, staff, classes, publishing, final results, submission packages', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array[
      'org.view', 'org.members.invite',
      'show.create', 'show.view', 'show.edit', 'show.delete', 'show.lock', 'show.publish', 'show.archive',
      'affiliation.add', 'affiliation.remove', 'affiliation.configure', 'affiliation.lock',
      'class.create', 'class.edit', 'class.delete', 'class.schedule', 'class.lock', 'class.combine', 'class.split',
      'entry.create', 'entry.edit', 'entry.delete', 'entry.scratch', 'entry.reinstate', 'entry.assign_back_number', 'entry.check_in',
      'person.create', 'person.edit', 'horse.create', 'horse.edit', 'ownership.edit', 'membership.edit',
      'document.upload', 'document.verify', 'document.reject', 'document.delete',
      'score.enter', 'score.edit_unofficial', 'score.correct_official', 'score.verify', 'score.finalize', 'score.publish',
      'result.view', 'result.publish', 'result.unpublish', 'result.export', 'result.submit_package',
      'payout.calculate', 'payout.approve', 'financial_reports.view', 'invoice.view',
      'report.view', 'report.generate', 'report.export',
      'audit.view', 'rules.view'
    ]);

  -- Show Secretary
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'show_secretary', 'Show Secretary', 'Entries, exhibitors, horses, back numbers, scores, reports, draft exports', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array[
      'org.view', 'show.view',
      'entry.create', 'entry.edit', 'entry.delete', 'entry.scratch', 'entry.reinstate', 'entry.assign_back_number', 'entry.check_in',
      'person.create', 'person.edit', 'horse.create', 'horse.edit', 'ownership.edit', 'membership.edit',
      'document.upload', 'document.verify', 'document.reject',
      'score.enter', 'score.edit_unofficial', 'score.verify',
      'result.view', 'result.export',
      'report.view', 'report.generate', 'report.export',
      'rules.view'
    ]);

  -- Assistant Secretary
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'assistant_secretary', 'Assistant Secretary', 'Entries, documents, check-in, packets, reports', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array[
      'org.view', 'show.view',
      'entry.create', 'entry.edit', 'entry.check_in',
      'person.create', 'person.edit', 'horse.create', 'horse.edit',
      'document.upload',
      'report.view', 'report.generate'
    ]);

  -- Judge
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'judge', 'Judge', 'Score assigned classes only', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array['show.view', 'score.enter']);

  -- Gate / Paddock
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'gate', 'Gate / Paddock', 'Order of go, check-in, hold/scratch/no-show', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array['show.view', 'entry.check_in', 'entry.scratch']);

  -- Announcer
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'announcer', 'Announcer', 'Read-only announcer screen and released results', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array['show.view', 'result.view']);

  -- Treasurer
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'treasurer', 'Treasurer', 'Invoices, payments, refunds, payout reconciliation, financial reports', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array[
      'org.view', 'show.view',
      'invoice.view', 'invoice.edit', 'payment.record', 'payment.refund',
      'payout.calculate', 'financial_reports.view',
      'report.view', 'report.export'
    ]);

  -- Score Verifier
  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'score_verifier', 'Score Verifier', 'Review scores and mark official', true)
  returning id into v_role;
  insert into public.organization_role_permissions (role_id, permission_key)
    select v_role, unnest(array['show.view', 'score.verify', 'result.view']);
end;
$$;

-- ------------------------------------------------------------
-- Audit helper (definer: audit_logs has no insert policy)
-- ------------------------------------------------------------

create or replace function public.log_audit(
  p_org uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_old jsonb default null,
  p_new jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_member(p_org) then
    raise exception 'Not a member of this organization';
  end if;
  insert into public.audit_logs (
    organization_id, actor_user_id, actor_role, action_type,
    entity_type, entity_id, old_value, new_value, reason
  )
  values (
    p_org, (select auth.uid()), public.org_role_key(p_org), p_action,
    p_entity_type, p_entity_id, p_old, p_new, p_reason
  );
end;
$$;

-- ------------------------------------------------------------
-- RPC: create organization (org + default roles + owner member)
-- ------------------------------------------------------------

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_owner_role uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, slug, contact_email, created_by)
  values (p_name, p_slug, p_contact_email, v_uid)
  returning id into v_org;

  perform public.seed_default_roles(v_org);

  select id into v_owner_role
  from public.organization_roles
  where organization_id = v_org and key = 'organization_owner';

  insert into public.organization_members (organization_id, user_id, role_id, status)
  values (v_org, v_uid, v_owner_role, 'active');

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, action_type, entity_type, entity_id, new_value)
  values (v_org, v_uid, 'organization_owner', 'organization.created', 'organization', v_org::text,
          jsonb_build_object('name', p_name, 'slug', p_slug));

  return v_org;
end;
$$;

-- ------------------------------------------------------------
-- RPC: invite member
-- ------------------------------------------------------------

create or replace function public.invite_member(
  p_org uuid,
  p_email text,
  p_role_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite uuid;
  v_role_org uuid;
  v_role_key text;
begin
  if not public.has_org_permission(p_org, 'org.members.invite') then
    raise exception 'Missing permission: org.members.invite';
  end if;

  select organization_id, key into v_role_org, v_role_key
  from public.organization_roles where id = p_role_id;
  if v_role_org is null or v_role_org <> p_org then
    raise exception 'Role does not belong to this organization';
  end if;

  -- Only role managers may hand out the owner role
  if v_role_key = 'organization_owner'
     and not public.has_org_permission(p_org, 'org.roles.manage') then
    raise exception 'Missing permission: org.roles.manage';
  end if;

  if exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org and lower(p.email) = lower(p_email)
  ) then
    raise exception 'That email already belongs to a member of this organization';
  end if;

  insert into public.organization_invites (organization_id, email, role_id, invited_by)
  values (p_org, lower(p_email), p_role_id, (select auth.uid()))
  returning id into v_invite;

  perform public.log_audit(p_org, 'member.invited', 'organization_invite', v_invite::text,
                           null, jsonb_build_object('email', lower(p_email), 'role_id', p_role_id));

  return v_invite;
end;
$$;

-- ------------------------------------------------------------
-- RPC: revoke invite
-- ------------------------------------------------------------

create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_email text;
begin
  select organization_id, email into v_org, v_email
  from public.organization_invites
  where id = p_invite and status = 'pending';

  if v_org is null then
    raise exception 'Invite not found or not pending';
  end if;
  if not public.has_org_permission(v_org, 'org.members.invite') then
    raise exception 'Missing permission: org.members.invite';
  end if;

  update public.organization_invites
  set status = 'revoked', responded_at = now()
  where id = p_invite;

  perform public.log_audit(v_org, 'member.invite_revoked', 'organization_invite', p_invite::text,
                           jsonb_build_object('email', v_email), null);
end;
$$;

-- ------------------------------------------------------------
-- RPC: list my pending invites (crosses org RLS deliberately,
-- scoped to the caller's email)
-- ------------------------------------------------------------

create or replace function public.my_pending_invites()
returns table (
  invite_id uuid,
  organization_name text,
  role_name text,
  invited_by_email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, o.name, r.name, p.email, i.created_at
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  join public.organization_roles r on r.id = i.role_id
  left join public.profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and lower(i.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''));
$$;

-- ------------------------------------------------------------
-- RPC: accept invite
-- ------------------------------------------------------------

create or replace function public.accept_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_member uuid;
  v_uid uuid := (select auth.uid());
begin
  select * into v_invite
  from public.organization_invites
  where id = p_invite and status = 'pending';

  if v_invite is null then
    raise exception 'Invite not found or not pending';
  end if;
  if lower(v_invite.email) <> lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'This invite was sent to a different email address';
  end if;
  if exists (
    select 1 from public.organization_members
    where organization_id = v_invite.organization_id and user_id = v_uid
  ) then
    raise exception 'You are already a member of this organization';
  end if;

  insert into public.organization_members (organization_id, user_id, role_id, status)
  values (v_invite.organization_id, v_uid, v_invite.role_id, 'active')
  returning id into v_member;

  update public.organization_invites
  set status = 'accepted', responded_at = now()
  where id = p_invite;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, action_type, entity_type, entity_id, new_value)
  values (v_invite.organization_id, v_uid, public.org_role_key(v_invite.organization_id),
          'member.joined', 'organization_member', v_member::text,
          jsonb_build_object('invite_id', p_invite));

  return v_invite.organization_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: change a member's role
-- ------------------------------------------------------------

create or replace function public.set_member_role(p_member uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member record;
  v_new_role record;
  v_old_role record;
  v_owner_count int;
begin
  select * into v_member from public.organization_members where id = p_member;
  if v_member is null then
    raise exception 'Member not found';
  end if;
  if not public.has_org_permission(v_member.organization_id, 'org.roles.manage') then
    raise exception 'Missing permission: org.roles.manage';
  end if;

  select * into v_new_role from public.organization_roles where id = p_role_id;
  if v_new_role is null or v_new_role.organization_id <> v_member.organization_id then
    raise exception 'Role does not belong to this organization';
  end if;

  select * into v_old_role from public.organization_roles where id = v_member.role_id;

  -- Never demote the last owner
  if v_old_role.key = 'organization_owner' and v_new_role.key <> 'organization_owner' then
    select count(*) into v_owner_count
    from public.organization_members m
    join public.organization_roles r on r.id = m.role_id
    where m.organization_id = v_member.organization_id
      and r.key = 'organization_owner' and m.status = 'active';
    if v_owner_count <= 1 then
      raise exception 'Cannot demote the last organization owner';
    end if;
  end if;

  update public.organization_members set role_id = p_role_id where id = p_member;

  perform public.log_audit(v_member.organization_id, 'member.role_changed', 'organization_member', p_member::text,
                           jsonb_build_object('role', v_old_role.key),
                           jsonb_build_object('role', v_new_role.key));
end;
$$;

-- ------------------------------------------------------------
-- RPC: remove member
-- ------------------------------------------------------------

create or replace function public.remove_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member record;
  v_role record;
  v_owner_count int;
  v_email text;
begin
  select * into v_member from public.organization_members where id = p_member;
  if v_member is null then
    raise exception 'Member not found';
  end if;

  -- Members may remove themselves (leave); otherwise requires permission
  if v_member.user_id <> (select auth.uid())
     and not public.has_org_permission(v_member.organization_id, 'org.members.remove') then
    raise exception 'Missing permission: org.members.remove';
  end if;

  select * into v_role from public.organization_roles where id = v_member.role_id;

  if v_role.key = 'organization_owner' then
    select count(*) into v_owner_count
    from public.organization_members m
    join public.organization_roles r on r.id = m.role_id
    where m.organization_id = v_member.organization_id
      and r.key = 'organization_owner' and m.status = 'active';
    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last organization owner';
    end if;
  end if;

  select email into v_email from public.profiles where id = v_member.user_id;

  perform public.log_audit(v_member.organization_id, 'member.removed', 'organization_member', p_member::text,
                           jsonb_build_object('email', v_email, 'role', v_role.key), null);

  delete from public.organization_members where id = p_member;
end;
$$;

-- ------------------------------------------------------------
-- Lock down function execution
-- ------------------------------------------------------------

revoke execute on function public.create_organization(text, text, text) from anon;
revoke execute on function public.invite_member(uuid, text, uuid) from anon;
revoke execute on function public.revoke_invite(uuid) from anon;
revoke execute on function public.my_pending_invites() from anon;
revoke execute on function public.accept_invite(uuid) from anon;
revoke execute on function public.set_member_role(uuid, uuid) from anon;
revoke execute on function public.remove_member(uuid) from anon;
revoke execute on function public.log_audit(uuid, text, text, text, jsonb, jsonb, text) from anon;
revoke execute on function public.seed_default_roles(uuid) from anon, authenticated;
