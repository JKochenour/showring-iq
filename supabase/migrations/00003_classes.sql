-- ============================================================
-- ShowRing IQ — Sprint 3: Classes
-- Class CRUD, basic fees (integer cents), schedule order.
-- Association affiliations/codes plug in via rule packages in a
-- later sprint (class_affiliations); nothing association-specific
-- is hard-coded here.
-- ============================================================

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  class_number integer not null check (class_number between 1 and 9999),
  display_order integer not null default 0,
  name text not null check (char_length(name) between 2 and 160),
  discipline text,
  division text,
  pattern_number integer check (pattern_number between 1 and 999),
  go_type text not null default 'Go',
  go_number integer not null default 1 check (go_number between 1 and 20),
  -- Money is integer cents, never floats
  entry_fee_cents integer not null default 0 check (entry_fee_cents >= 0),
  added_money_cents integer not null default 0 check (added_money_cents >= 0),
  status text not null default 'draft' check (status in (
    'draft', 'open', 'entry_closed', 'draw_posted', 'in_progress',
    'scoring', 'pending_verification', 'official', 'results_posted',
    'exported', 'archived', 'cancelled'
  )),
  scheduled_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, class_number)
);

create index classes_show_order_idx on public.classes (show_id, display_order);

alter table public.classes enable row level security;

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- Sync organization_id from the parent show and auto-assign
-- display_order to the end of the schedule when not provided.
create or replace function public.classes_before_insert()
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
  if new.display_order is null or new.display_order <= 0 then
    select coalesce(max(display_order), 0) + 1 into new.display_order
    from public.classes where show_id = new.show_id;
  end if;
  return new;
end;
$$;

create trigger classes_before_insert
  before insert on public.classes
  for each row execute function public.classes_before_insert();

-- ------------------------------------------------------------
-- RLS: reads follow show.view; writes require class permissions
-- and an unlocked (draft/published) show.
-- ------------------------------------------------------------

create or replace function public.show_is_editable(p_show uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shows s
    where s.id = p_show and s.status in ('draft', 'published')
  );
$$;

create policy "classes_select_permitted" on public.classes
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "classes_insert_permitted" on public.classes
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'class.create')
    and public.show_is_editable(show_id)
  );

create policy "classes_update_permitted" on public.classes
  for update to authenticated
  using (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  )
  with check (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

create policy "classes_delete_permitted" on public.classes
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'class.delete')
    and public.show_is_editable(show_id)
  );
