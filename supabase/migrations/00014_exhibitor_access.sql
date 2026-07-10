-- ============================================================
-- ShowRing IQ — Exhibitor-facing self-service access
-- Everything before this migration is office/staff-only. This adds a
-- second access path: a person record can be linked to a login
-- (people.user_id), and an "Exhibitor" org role whose access is scoped
-- entirely to their OWN linked person/horses/entries/documents via
-- dedicated RLS policies — never the broad has_org_permission() grants
-- the office roles use, so an exhibitor can never see another
-- exhibitor's data even though they're an organization_member.
-- ============================================================

alter table public.people
  add column user_id uuid references auth.users (id) on delete set null;

-- One person profile per (org, login) — a user could be an exhibitor
-- in more than one org, each with their own person record.
create unique index people_org_user_unique
  on public.people (organization_id, user_id)
  where user_id is not null;

-- Invites can optionally pre-link to an existing person record, so
-- accepting the invite claims that profile automatically instead of
-- exhibitors having to self-match by name.
alter table public.organization_invites
  add column person_id uuid references public.people (id) on delete set null;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

create or replace function public.is_own_person(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_person is not null and exists (
    select 1 from public.people where id = p_person and user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_horse_as_exhibitor(p_horse uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_horse is not null and exists (
    select 1
    from public.horse_ownerships ho
    join public.people p on p.id = ho.owner_person_id
    where ho.horse_id = p_horse and p.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_own_person(uuid) from anon;
revoke execute on function public.owns_horse_as_exhibitor(uuid) from anon;

-- ------------------------------------------------------------
-- Exhibitor system role (per-org; created lazily the first time a
-- person is invited as an exhibitor, mirroring org creation's role
-- seeding but scoped to what already-created orgs need too)
-- ------------------------------------------------------------

create or replace function public.ensure_exhibitor_role(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid;
begin
  select id into v_role from public.organization_roles
  where organization_id = p_org and key = 'exhibitor';
  if v_role is not null then
    return v_role;
  end if;

  insert into public.organization_roles (organization_id, key, name, description, is_system)
  values (p_org, 'exhibitor', 'Exhibitor', 'Own profile, horses, documents, and entries only', true)
  returning id into v_role;

  -- Deliberately zero permissions: org.view (and everything else in the
  -- catalog) gates broad org-wide SELECT on people/horses/memberships/
  -- documents — granting it to Exhibitor would let one exhibitor see
  -- every other exhibitor's data. Exhibitor access comes entirely from
  -- the self-scoped RLS policies below, which don't check permissions
  -- at all, just row ownership.

  return v_role;
end;
$$;

revoke execute on function public.ensure_exhibitor_role(uuid) from anon;

-- ------------------------------------------------------------
-- RPC: invite a person as an exhibitor (creates the invite pre-linked
-- to their person record; accept_invite below claims it on acceptance)
-- ------------------------------------------------------------

create or replace function public.invite_exhibitor(p_person uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_role uuid;
  v_invite uuid;
begin
  select organization_id into v_org from public.people where id = p_person;
  if v_org is null then
    raise exception 'Person not found';
  end if;
  if not public.has_org_permission(v_org, 'org.members.invite') then
    raise exception 'Missing permission: org.members.invite';
  end if;
  if exists (select 1 from public.people where id = p_person and user_id is not null) then
    raise exception 'This person is already linked to a login';
  end if;

  v_role := public.ensure_exhibitor_role(v_org);

  if exists (
    select 1 from public.organization_members m
    join public.profiles pr on pr.id = m.user_id
    where m.organization_id = v_org and lower(pr.email) = lower(p_email)
  ) then
    raise exception 'That email already belongs to a member of this organization';
  end if;

  insert into public.organization_invites (organization_id, email, role_id, invited_by, person_id)
  values (v_org, lower(p_email), v_role, (select auth.uid()), p_person)
  returning id into v_invite;

  perform public.log_audit(v_org, 'exhibitor.invited', 'organization_invite', v_invite::text,
    null, jsonb_build_object('email', lower(p_email), 'person_id', p_person));

  return v_invite;
end;
$$;

revoke execute on function public.invite_exhibitor(uuid, text) from anon;

-- accept_invite (00001) already inserts the organization_member row;
-- extend it to also claim the linked person record, if any.
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

  if v_invite.person_id is not null then
    update public.people set user_id = v_uid where id = v_invite.person_id and user_id is null;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, action_type, entity_type, entity_id, new_value)
  values (v_invite.organization_id, v_uid, public.org_role_key(v_invite.organization_id),
          'member.joined', 'organization_member', v_member::text,
          jsonb_build_object('invite_id', p_invite));

  return v_invite.organization_id;
end;
$$;

revoke execute on function public.accept_invite(uuid) from anon;

-- ------------------------------------------------------------
-- Self-scoped RLS (additive — these sit alongside the existing
-- office-role policies, they don't replace them)
-- ------------------------------------------------------------

create policy "shows_select_exhibitor" on public.shows
  for select to authenticated
  using (public.is_org_member(organization_id) and status <> 'draft');

create policy "classes_select_exhibitor" on public.classes
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.shows s where s.id = classes.show_id and s.status <> 'draft')
  );

create policy "people_select_self" on public.people
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "horses_select_owned_by_exhibitor" on public.horses
  for select to authenticated
  using (public.owns_horse_as_exhibitor(id));

create policy "horse_ownerships_select_own" on public.horse_ownerships
  for select to authenticated
  using (public.is_own_person(owner_person_id));

create policy "horse_registrations_select_owned" on public.horse_registrations
  for select to authenticated
  using (public.owns_horse_as_exhibitor(horse_id));

create policy "person_memberships_select_self" on public.person_memberships
  for select to authenticated
  using (public.is_own_person(person_id));

create policy "entries_select_own" on public.entries
  for select to authenticated
  using (public.is_own_person(rider_person_id) or public.is_own_person(owner_person_id));

create policy "entries_insert_own" on public.entries
  for insert to authenticated
  with check (
    public.is_own_person(rider_person_id)
    and exists (select 1 from public.shows s where s.id = show_id and s.status = 'published')
  );

create policy "entry_classes_select_own" on public.entry_classes
  for select to authenticated
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_classes.entry_id
        and (public.is_own_person(e.rider_person_id) or public.is_own_person(e.owner_person_id))
    )
  );

create policy "entry_classes_insert_own" on public.entry_classes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.entries e
      join public.shows s on s.id = e.show_id
      where e.id = entry_classes.entry_id
        and public.is_own_person(e.rider_person_id)
        and s.status = 'published'
    )
  );

create policy "back_numbers_select_own" on public.back_numbers
  for select to authenticated
  using (
    exists (
      select 1 from public.entries e
      where e.id = back_numbers.entry_id
        and (public.is_own_person(e.rider_person_id) or public.is_own_person(e.owner_person_id))
    )
  );

create policy "documents_select_own" on public.documents
  for select to authenticated
  using (public.is_own_person(person_id) or public.owns_horse_as_exhibitor(horse_id));

create policy "documents_insert_own" on public.documents
  for insert to authenticated
  with check (public.is_own_person(person_id) or public.owns_horse_as_exhibitor(horse_id));

create policy "documents_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = storage.objects.name
        and (public.is_own_person(d.person_id) or public.owns_horse_as_exhibitor(d.horse_id))
    )
  );

create policy "documents_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- ------------------------------------------------------------
-- RPC: exhibitor self-scratch (mirrors scratch_entry_class, but checks
-- ownership instead of entry.scratch, and only while the show is still
-- open — locked/closed shows require going through the office)
-- ------------------------------------------------------------

create or replace function public.exhibitor_scratch_entry_class(
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
  select ec.*, c.class_number, e.rider_person_id, e.owner_person_id, s.status as show_status
  into v_row
  from public.entry_classes ec
  join public.classes c on c.id = ec.class_id
  join public.entries e on e.id = ec.entry_id
  join public.shows s on s.id = ec.show_id
  where ec.id = p_entry_class;

  if v_row is null then
    raise exception 'Entry class not found';
  end if;
  if not (public.is_own_person(v_row.rider_person_id) or public.is_own_person(v_row.owner_person_id)) then
    raise exception 'Not your entry';
  end if;
  if v_row.show_status <> 'published' then
    raise exception 'This show is no longer open for self-service changes — contact the show office';
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
    coalesce(p_reason, 'Scratched by exhibitor'));
end;
$$;

revoke execute on function public.exhibitor_scratch_entry_class(uuid, text) from anon;
