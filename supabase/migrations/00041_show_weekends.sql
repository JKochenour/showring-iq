-- ============================================================
-- ShowRing IQ — Show weekends (EPRHA two-slate model)
--
-- EPRHA runs every class as two slates: the same class list offered as
-- two separately-placed, separately-paid, separately-submitted NRHA
-- shows in one weekend, where a horse makes two separate runs (one per
-- slate). "Two separate shows" is therefore the CORRECT model, not a
-- workaround — scoring, results, payouts, and the per-show NRHA export
-- are already right per slate and are untouched here. What was missing
-- is the layer HSW calls a "circuit": a grouping that ties the weekend's
-- shows together so the office enters things ONCE, not twice.
--
-- This migration adds three things and nothing else:
--
--   1. show_weekends — the grouping. Every show belongs to exactly one
--      weekend; a standalone show is a weekend-of-one (auto-created by a
--      trigger on insert, and backfilled for existing shows). A real
--      two-slate weekend is just two shows sharing one weekend.
--
--   2. Horse-level back numbers. The back number belongs to the HORSE
--      for the whole weekend — same number across every rider, class,
--      and slate. weekend_back_numbers(weekend_id, horse_id) -> number
--      is the source of truth; the existing per-entry back_numbers table
--      stays as a read projection (26 read sites keep working unchanged),
--      kept in sync by assign_back_number. The old unique(show_id,number)
--      is dropped because a horse shown by three riders in one class is
--      three entries carrying ONE number.
--
--   3. Fee timing keyed to horse-per-weekend. Office / stall / drug (the
--      non-per_run standard charges) are charged ONCE per horse per
--      weekend — when the horse first gets its number — instead of once
--      per entry. Per-run charges (class fee, video, photography) are
--      unchanged: they still fire per run, so one horse + one class +
--      three riders = three sets, automatically.
-- ============================================================

-- ------------------------------------------------------------
-- 1. show_weekends
-- ------------------------------------------------------------

create table public.show_weekends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index show_weekends_org_idx on public.show_weekends (organization_id, created_at desc);

alter table public.show_weekends enable row level security;

create trigger show_weekends_set_updated_at
  before update on public.show_weekends
  for each row execute function public.set_updated_at();

create policy "show_weekends_select_permitted" on public.show_weekends
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

-- All writes go through the security-definer RPCs below (create / group /
-- rename), each audit-logged, matching how the rest of the app mutates.
revoke insert, update, delete on public.show_weekends from authenticated;

-- ------------------------------------------------------------
-- 2. shows.weekend_id + auto-create-a-weekend-of-one trigger + backfill
-- ------------------------------------------------------------

alter table public.shows
  add column weekend_id uuid references public.show_weekends (id) on delete restrict;

create index shows_weekend_idx on public.shows (weekend_id);

-- Every show gets a weekend. A brand-new standalone show becomes a
-- weekend-of-one automatically so back numbers are horse-level from day
-- one (EPRHA's rule holds even on a one-slate show); a show meant to be
-- a second slate is moved into the existing weekend afterward by
-- group_shows_into_weekend().
create or replace function public.shows_assign_weekend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weekend_id uuid;
begin
  if new.weekend_id is null then
    insert into public.show_weekends (organization_id, name, created_by)
    values (new.organization_id, new.name, (select auth.uid()))
    returning id into v_weekend_id;
    new.weekend_id := v_weekend_id;
  end if;
  return new;
end;
$$;

create trigger shows_assign_weekend
  before insert on public.shows
  for each row execute function public.shows_assign_weekend();

-- Backfill: one weekend-of-one per existing show.
do $$
declare
  r record;
  v_wid uuid;
begin
  for r in select id, organization_id, name from public.shows where weekend_id is null loop
    insert into public.show_weekends (organization_id, name)
    values (r.organization_id, r.name)
    returning id into v_wid;
    update public.shows set weekend_id = v_wid where id = r.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. weekend_back_numbers (source of truth) + back_numbers projection
-- ------------------------------------------------------------

create table public.weekend_back_numbers (
  id uuid primary key default gen_random_uuid(),
  weekend_id uuid not null references public.show_weekends (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  horse_id uuid not null references public.horses (id) on delete restrict,
  number integer not null check (number between 1 and 9999),
  created_at timestamptz not null default now(),
  unique (weekend_id, number),
  unique (weekend_id, horse_id)
);

create index weekend_back_numbers_horse_idx on public.weekend_back_numbers (horse_id);

alter table public.weekend_back_numbers enable row level security;

create policy "weekend_back_numbers_select_permitted" on public.weekend_back_numbers
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

-- Written only by assign_back_number / release_back_number (security definer).
revoke insert, update, delete on public.weekend_back_numbers from authenticated;

-- The per-entry projection gains horse_id, and loses unique(show_id,
-- number): within a slate a horse's single number can appear on several
-- entries (different riders on the same horse). Real uniqueness now lives
-- on weekend_back_numbers.
alter table public.back_numbers
  add column horse_id uuid references public.horses (id) on delete restrict;

update public.back_numbers bn
  set horse_id = e.horse_id
  from public.entries e
  where e.id = bn.entry_id;

alter table public.back_numbers alter column horse_id set not null;

alter table public.back_numbers drop constraint back_numbers_show_id_number_key;

-- Seed weekend_back_numbers from whatever numbers already exist (one per
-- horse per weekend; if a horse somehow held two numbers historically,
-- take the lowest and normalize the projection to it so the two copies
-- never disagree). For existing data — one show per weekend, one entry
-- per horse — this is exact.
insert into public.weekend_back_numbers (weekend_id, organization_id, horse_id, number)
select s.weekend_id, bn.organization_id, bn.horse_id, min(bn.number)
from public.back_numbers bn
join public.shows s on s.id = bn.show_id
group by s.weekend_id, bn.organization_id, bn.horse_id;

update public.back_numbers bn
  set number = wbn.number
  from public.shows s, public.weekend_back_numbers wbn
  where s.id = bn.show_id
    and wbn.weekend_id = s.weekend_id
    and wbn.horse_id = bn.horse_id
    and bn.number <> wbn.number;

-- ------------------------------------------------------------
-- assign_back_number: horse-per-weekend. Same signature (p_entry,
-- p_number) so every existing caller is unchanged, but the number now
-- belongs to the horse across the whole weekend, and the once-per-entry
-- standard charges become once-per-horse-per-weekend (charged only when
-- the horse first gets its number).
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
  v_weekend_id uuid;
  v_wbn record;
  v_num integer;
  v_first_time boolean := false;
  v_proj record;
  v_charges jsonb;
  v_charge jsonb;
  v_billed_person uuid;
  v_label text;
  v_amount integer;
  v_all_youth boolean;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.assign_back_number') then
    raise exception 'Missing permission: entry.assign_back_number';
  end if;

  select weekend_id into v_weekend_id from public.shows where id = v_entry.show_id;
  if v_weekend_id is null then
    raise exception 'Show has no weekend';
  end if;

  select * into v_wbn
  from public.weekend_back_numbers
  where weekend_id = v_weekend_id and horse_id = v_entry.horse_id;

  if p_number is not null then
    v_num := p_number;
    if exists (
      select 1 from public.weekend_back_numbers
      where weekend_id = v_weekend_id and number = v_num and horse_id <> v_entry.horse_id
    ) then
      raise exception 'Back number % is already used by another horse this weekend', v_num;
    end if;
  elsif v_wbn is not null then
    v_num := v_wbn.number;
  else
    select coalesce(max(number), 0) + 1 into v_num
    from public.weekend_back_numbers where weekend_id = v_weekend_id;
  end if;

  -- Upsert the horse's weekend number (the source of truth).
  if v_wbn is null then
    v_first_time := true;
    insert into public.weekend_back_numbers (weekend_id, organization_id, horse_id, number)
    values (v_weekend_id, v_entry.organization_id, v_entry.horse_id, v_num);
    perform public.log_audit(v_entry.organization_id, 'back_number.assigned', 'weekend_back_number', null,
      null, jsonb_build_object('horse_id', v_entry.horse_id, 'weekend_id', v_weekend_id, 'number', v_num),
      null, v_entry.show_id);
  elsif v_wbn.number <> v_num then
    -- Manual transfer to a new number: move the horse and re-point every
    -- projection row for that horse across all of the weekend's slates.
    update public.weekend_back_numbers set number = v_num where id = v_wbn.id;
    update public.back_numbers bn
      set number = v_num
      from public.shows s
      where s.id = bn.show_id and s.weekend_id = v_weekend_id and bn.horse_id = v_entry.horse_id;
    perform public.log_audit(v_entry.organization_id, 'back_number.transferred', 'weekend_back_number', v_wbn.id::text,
      jsonb_build_object('horse_id', v_entry.horse_id, 'number', v_wbn.number),
      jsonb_build_object('horse_id', v_entry.horse_id, 'number', v_num),
      null, v_entry.show_id);
  end if;

  -- Upsert THIS entry's projection row so the 26 read sites see a number.
  select * into v_proj from public.back_numbers where entry_id = p_entry;
  if v_proj is null then
    insert into public.back_numbers (show_id, organization_id, number, entry_id, horse_id)
    values (v_entry.show_id, v_entry.organization_id, v_num, p_entry, v_entry.horse_id);
  elsif v_proj.number <> v_num then
    update public.back_numbers set number = v_num where entry_id = p_entry;
  end if;

  -- Once-per-horse-per-weekend standard charges (office / stall / drug):
  -- only when the horse first gets a number this weekend. Skipped when the
  -- triggering entry is all-youth (Show Rules P(7)). Per-run charges are
  -- excluded here — apply_per_run_charges bills those per class/run.
  if v_first_time then
    select bool_and(c.is_youth) into v_all_youth
    from public.entry_classes ec
    join public.classes c on c.id = ec.class_id
    where ec.entry_id = p_entry and ec.status = 'entered';

    if coalesce(v_all_youth, false) = false then
      select standard_entry_charges into v_charges from public.shows where id = v_entry.show_id;
      v_billed_person := case
        when v_entry.bill_to_trainer and v_entry.trainer_person_id is not null
          then v_entry.trainer_person_id
        else coalesce(v_entry.owner_person_id, v_entry.rider_person_id)
      end;

      for v_charge in
        select * from jsonb_array_elements(coalesce(v_charges, '[]'::jsonb))
        where (value->>'per_run')::boolean is not true
      loop
        v_label := nullif(btrim(v_charge->>'label'), '');
        v_amount := nullif(v_charge->>'amount_cents', '')::integer;
        if v_label is not null and v_amount is not null and v_amount > 0 then
          insert into public.misc_charges (
            show_id, organization_id, person_id, description, category, amount_cents, created_by
          )
          values (
            v_entry.show_id, v_entry.organization_id, v_billed_person, v_label, v_label, v_amount, (select auth.uid())
          );
          perform public.log_audit(v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
            null,
            jsonb_build_object('person_id', v_billed_person, 'description', v_label,
                               'category', v_label, 'amount_cents', v_amount,
                               'source', 'weekend_horse_charge', 'horse_id', v_entry.horse_id),
            null, v_entry.show_id);
        end if;
      end loop;
    end if;
  end if;

  return v_num;
end;
$$;

-- ------------------------------------------------------------
-- release_back_number: drop this entry's projection row; if the horse has
-- no remaining numbered entry anywhere in the weekend, release the
-- weekend number too. Charges already applied are not auto-refunded
-- (same contract as before — the office removes them on the bill).
-- ------------------------------------------------------------

create or replace function public.release_back_number(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_weekend_id uuid;
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

  select weekend_id into v_weekend_id from public.shows where id = v_entry.show_id;

  delete from public.back_numbers where entry_id = p_entry;

  if not exists (
    select 1 from public.back_numbers bn
    join public.shows s on s.id = bn.show_id
    where s.weekend_id = v_weekend_id and bn.horse_id = v_entry.horse_id
  ) then
    delete from public.weekend_back_numbers
    where weekend_id = v_weekend_id and horse_id = v_entry.horse_id;
  end if;

  perform public.log_audit(v_entry.organization_id, 'back_number.released', 'back_number', v_existing.id::text,
    jsonb_build_object('entry_id', p_entry, 'number', v_existing.number, 'horse_id', v_entry.horse_id), null,
    null, v_entry.show_id);
end;
$$;

-- ------------------------------------------------------------
-- RPC: create a weekend and pull existing shows into it (the "group
-- these two slates" action). Empty weekends left behind by the move are
-- cleaned up. Refused if a moving show already has entries — grouping is
-- a setup step, before back numbers exist, so numbering never has to be
-- reconciled mid-stream.
-- ------------------------------------------------------------

create or replace function public.group_shows_into_weekend(
  p_org uuid,
  p_name text,
  p_show_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weekend_id uuid;
  v_show_id uuid;
  v_show record;
  v_old_weekend uuid;
begin
  if not public.has_org_permission(p_org, 'show.create') then
    raise exception 'Missing permission: show.create';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'A weekend name is required';
  end if;
  if array_length(p_show_ids, 1) is null then
    raise exception 'Select at least one show';
  end if;

  -- Validate every show first (all in this org, none with entries).
  foreach v_show_id in array p_show_ids loop
    select * into v_show from public.shows where id = v_show_id;
    if v_show is null or v_show.organization_id <> p_org then
      raise exception 'Show not found in this organization';
    end if;
    if exists (select 1 from public.entries where show_id = v_show_id) then
      raise exception 'Show "%" already has entries — group shows into a weekend before taking entries', v_show.name;
    end if;
  end loop;

  insert into public.show_weekends (organization_id, name, created_by)
  values (p_org, btrim(p_name), (select auth.uid()))
  returning id into v_weekend_id;

  foreach v_show_id in array p_show_ids loop
    select weekend_id into v_old_weekend from public.shows where id = v_show_id;
    update public.shows set weekend_id = v_weekend_id where id = v_show_id;
    -- Clean up the auto-created weekend-of-one now emptied by the move.
    if v_old_weekend is not null
       and not exists (select 1 from public.shows where weekend_id = v_old_weekend) then
      delete from public.show_weekends where id = v_old_weekend;
    end if;
  end loop;

  perform public.log_audit(p_org, 'weekend.created', 'show_weekend', v_weekend_id::text,
    null, jsonb_build_object('name', btrim(p_name), 'show_ids', to_jsonb(p_show_ids)));

  return v_weekend_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: add one existing show to an existing weekend (extend a weekend
-- with another slate). Same entries-free guard.
-- ------------------------------------------------------------

create or replace function public.add_show_to_weekend(
  p_show uuid,
  p_weekend uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_weekend record;
  v_old_weekend uuid;
begin
  select * into v_show from public.shows where id = p_show;
  if v_show is null then
    raise exception 'Show not found';
  end if;
  if not public.has_org_permission(v_show.organization_id, 'show.edit') then
    raise exception 'Missing permission: show.edit';
  end if;
  select * into v_weekend from public.show_weekends where id = p_weekend;
  if v_weekend is null or v_weekend.organization_id <> v_show.organization_id then
    raise exception 'Weekend not found in this organization';
  end if;
  if exists (select 1 from public.entries where show_id = p_show) then
    raise exception 'This show already has entries — group shows before taking entries';
  end if;

  v_old_weekend := v_show.weekend_id;
  update public.shows set weekend_id = p_weekend where id = p_show;
  if v_old_weekend is not null and v_old_weekend <> p_weekend
     and not exists (select 1 from public.shows where weekend_id = v_old_weekend) then
    delete from public.show_weekends where id = v_old_weekend;
  end if;

  perform public.log_audit(v_show.organization_id, 'weekend.show_added', 'show_weekend', p_weekend::text,
    null, jsonb_build_object('show_id', p_show, 'weekend_id', p_weekend), null, p_show);
end;
$$;

-- ------------------------------------------------------------
-- RPC: rename a weekend.
-- ------------------------------------------------------------

create or replace function public.rename_weekend(p_weekend uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weekend record;
begin
  select * into v_weekend from public.show_weekends where id = p_weekend;
  if v_weekend is null then
    raise exception 'Weekend not found';
  end if;
  if not public.has_org_permission(v_weekend.organization_id, 'show.edit') then
    raise exception 'Missing permission: show.edit';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'A weekend name is required';
  end if;

  update public.show_weekends set name = btrim(p_name) where id = p_weekend;

  perform public.log_audit(v_weekend.organization_id, 'weekend.renamed', 'show_weekend', p_weekend::text,
    jsonb_build_object('name', v_weekend.name), jsonb_build_object('name', btrim(p_name)));
end;
$$;

revoke execute on function public.assign_back_number(uuid, integer) from anon;
revoke execute on function public.release_back_number(uuid) from anon;
revoke execute on function public.group_shows_into_weekend(uuid, text, uuid[]) from anon;
revoke execute on function public.add_show_to_weekend(uuid, uuid) from anon;
revoke execute on function public.rename_weekend(uuid, text) from anon;
