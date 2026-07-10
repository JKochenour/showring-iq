-- ============================================================
-- ShowRing IQ — Exhibitor self-service profile/horse editing
-- Exhibitor access is otherwise entirely SELECT-only (migration
-- 00014). Rather than adding raw UPDATE/INSERT RLS policies on
-- `people`/`horses` — which by default grant every column to
-- `authenticated` and would let an exhibitor set fields like `roles`
-- or `notes` that only staff should touch — self-edits go through
-- dedicated RPCs that whitelist exactly which columns can change,
-- mirroring the existing pattern for entries/back_numbers.
-- ============================================================

create or replace function public.exhibitor_update_person(
  p_person uuid,
  p_preferred_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_state text,
  p_birthdate date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_own_person(p_person) then
    raise exception 'Not your profile';
  end if;

  update public.people
  set preferred_name = nullif(btrim(coalesce(p_preferred_name, '')), ''),
      email = nullif(btrim(coalesce(p_email, '')), ''),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      city = nullif(btrim(coalesce(p_city, '')), ''),
      state = nullif(btrim(coalesce(p_state, '')), ''),
      birthdate = p_birthdate
  where id = p_person;
end;
$$;

revoke execute on function public.exhibitor_update_person(uuid, text, text, text, text, text, date) from anon;

create or replace function public.exhibitor_update_horse(
  p_horse uuid,
  p_barn_name text,
  p_breed text,
  p_sex text,
  p_color text,
  p_foal_year integer,
  p_sire text,
  p_dam text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_horse_as_exhibitor(p_horse) then
    raise exception 'Not your horse';
  end if;

  update public.horses
  set barn_name = nullif(btrim(coalesce(p_barn_name, '')), ''),
      breed = nullif(btrim(coalesce(p_breed, '')), ''),
      sex = nullif(btrim(coalesce(p_sex, '')), ''),
      color = nullif(btrim(coalesce(p_color, '')), ''),
      foal_year = p_foal_year,
      sire = nullif(btrim(coalesce(p_sire, '')), ''),
      dam = nullif(btrim(coalesce(p_dam, '')), '')
  where id = p_horse;
end;
$$;

revoke execute on function public.exhibitor_update_horse(uuid, text, text, text, text, integer, text, text) from anon;

-- Registered name is deliberately excluded from exhibitor_update_horse
-- (it's the association-registered identity of the horse — changing it
-- is a staff/registration-paperwork action) but IS settable at creation.
create or replace function public.exhibitor_create_horse(
  p_org uuid,
  p_registered_name text,
  p_barn_name text,
  p_breed text,
  p_sex text,
  p_color text,
  p_foal_year integer,
  p_sire text,
  p_dam text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person uuid;
  v_horse uuid;
begin
  select id into v_person from public.people
  where organization_id = p_org and user_id = (select auth.uid());
  if v_person is null then
    raise exception 'No exhibitor profile for this organization';
  end if;
  if btrim(coalesce(p_registered_name, '')) = '' then
    raise exception 'Registered name is required';
  end if;

  insert into public.horses (
    organization_id, registered_name, barn_name, breed, sex, color, foal_year, sire, dam
  )
  values (
    p_org, btrim(p_registered_name), nullif(btrim(coalesce(p_barn_name, '')), ''),
    nullif(btrim(coalesce(p_breed, '')), ''), nullif(btrim(coalesce(p_sex, '')), ''),
    nullif(btrim(coalesce(p_color, '')), ''), p_foal_year,
    nullif(btrim(coalesce(p_sire, '')), ''), nullif(btrim(coalesce(p_dam, '')), '')
  )
  returning id into v_horse;

  insert into public.horse_ownerships (horse_id, organization_id, owner_person_id, percentage)
  values (v_horse, p_org, v_person, 100);

  perform public.log_audit(p_org, 'horse.created', 'horse', v_horse::text,
    null, jsonb_build_object('registered_name', p_registered_name, 'source', 'exhibitor'));

  return v_horse;
end;
$$;

revoke execute on function public.exhibitor_create_horse(uuid, text, text, text, text, text, integer, text, text) from anon;
