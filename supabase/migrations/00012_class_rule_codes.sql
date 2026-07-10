-- ============================================================
-- ShowRing IQ — Wire rule packages into Classes
-- Links a show class to a specific association_class_codes row from
-- an org's rule package, so eligibility rules and export codes can be
-- driven by rule-package data instead of the free-text nrha_class_code
-- field (kept for manual/legacy use and as an export fallback).
-- ============================================================

alter table public.classes
  add column class_code_id uuid references public.association_class_codes (id) on delete set null;

create index classes_class_code_idx on public.classes (class_code_id);

-- A class's linked code must belong to the same organization as the
-- class itself — cheap to check here rather than trusting the client.
create or replace function public.classes_check_class_code_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code_org uuid;
begin
  if new.class_code_id is null then
    return new;
  end if;
  select organization_id into v_code_org
  from public.association_class_codes where id = new.class_code_id;
  if v_code_org is null or v_code_org <> new.organization_id then
    raise exception 'Class code does not belong to this organization';
  end if;
  return new;
end;
$$;

create trigger classes_check_class_code_org
  before insert or update of class_code_id on public.classes
  for each row execute function public.classes_check_class_code_org();
