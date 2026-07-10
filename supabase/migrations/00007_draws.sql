-- ============================================================
-- ShowRing IQ — Sprint 7: Draws & gate
-- class_draws holds the order of go per class plus each run's
-- gate status. Draw rows are managed with class.schedule; gate
-- status changes flow through an RPC gated by entry.check_in.
-- ============================================================

-- Drag frequency lives on the class (shown as markers on the gate screen)
alter table public.classes
  add column drag_every_n integer check (drag_every_n between 1 and 50);

create table public.class_draws (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_class_id uuid not null references public.entry_classes (id) on delete cascade,
  position integer not null check (position between 1 and 9999),
  run_status text not null default 'pending' check (run_status in (
    'pending', 'at_gate', 'in_arena', 'completed', 'hold', 'no_show', 'scratched'
  )),
  created_at timestamptz not null default now(),
  unique (class_id, entry_class_id)
);

create index class_draws_class_position_idx on public.class_draws (class_id, position);

alter table public.class_draws enable row level security;

create or replace function public.class_draws_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ec_class uuid;
begin
  select show_id, organization_id into new.show_id, new.organization_id
  from public.classes where id = new.class_id;
  if new.organization_id is null then
    raise exception 'Class not found';
  end if;
  select class_id into v_ec_class from public.entry_classes where id = new.entry_class_id;
  if v_ec_class is null or v_ec_class <> new.class_id then
    raise exception 'Entry class does not belong to this class';
  end if;
  return new;
end;
$$;

create trigger class_draws_before_insert
  before insert on public.class_draws
  for each row execute function public.class_draws_before_insert();

-- ------------------------------------------------------------
-- RLS: gate/announcer/judges read via show.view; draw rows are
-- created/removed with class.schedule; updates via RPCs only.
-- ------------------------------------------------------------

create policy "class_draws_select_permitted" on public.class_draws
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "class_draws_insert_permitted" on public.class_draws
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'class.schedule')
    and public.show_is_editable(show_id)
  );

create policy "class_draws_delete_permitted" on public.class_draws
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'class.schedule')
    and public.show_is_editable(show_id)
  );

revoke update on public.class_draws from authenticated;

-- ------------------------------------------------------------
-- RPC: move a draw row up/down (swap with neighbor)
-- ------------------------------------------------------------

create or replace function public.move_draw_row(p_row uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_neighbor record;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Direction must be up or down';
  end if;

  select * into v_row from public.class_draws where id = p_row;
  if v_row is null then
    raise exception 'Draw row not found';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'class.schedule') then
    raise exception 'Missing permission: class.schedule';
  end if;

  if p_direction = 'up' then
    select * into v_neighbor from public.class_draws
    where class_id = v_row.class_id and position < v_row.position
    order by position desc limit 1;
  else
    select * into v_neighbor from public.class_draws
    where class_id = v_row.class_id and position > v_row.position
    order by position asc limit 1;
  end if;

  if v_neighbor is null then
    return;
  end if;

  update public.class_draws set position = v_neighbor.position where id = v_row.id;
  update public.class_draws set position = v_row.position where id = v_neighbor.id;

  perform public.log_audit(v_row.organization_id, 'draw.reordered', 'class_draw', p_row::text,
    jsonb_build_object('class_id', v_row.class_id, 'position', v_row.position),
    jsonb_build_object('position', v_neighbor.position));
end;
$$;

-- ------------------------------------------------------------
-- RPC: gate status changes (one-tap actions)
-- Setting in_arena auto-completes any other in_arena run in the
-- class. Scratching from the gate also scratches the entry_class
-- (requires entry.scratch). Hold/no-show/scratch are audited.
-- ------------------------------------------------------------

create or replace function public.set_run_status(
  p_row uuid,
  p_status text,
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
  if p_status not in ('pending', 'at_gate', 'in_arena', 'completed', 'hold', 'no_show', 'scratched') then
    raise exception 'Invalid run status: %', p_status;
  end if;

  select * into v_row from public.class_draws where id = p_row;
  if v_row is null then
    raise exception 'Draw row not found';
  end if;
  if not public.has_org_permission(v_row.organization_id, 'entry.check_in') then
    raise exception 'Missing permission: entry.check_in';
  end if;
  if v_row.run_status = p_status then
    return;
  end if;

  if p_status = 'scratched' then
    if not public.has_org_permission(v_row.organization_id, 'entry.scratch') then
      raise exception 'Missing permission: entry.scratch';
    end if;
    update public.entry_classes
    set status = 'scratched',
        scratch_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), scratch_reason)
    where id = v_row.entry_class_id and status = 'entered';
  end if;

  if p_status = 'in_arena' then
    update public.class_draws
    set run_status = 'completed'
    where class_id = v_row.class_id and run_status = 'in_arena' and id <> p_row;
  end if;

  update public.class_draws set run_status = p_status where id = p_row;

  if p_status in ('hold', 'no_show', 'scratched') then
    perform public.log_audit(v_row.organization_id, 'gate.' || p_status, 'class_draw', p_row::text,
      jsonb_build_object('class_id', v_row.class_id, 'previous', v_row.run_status),
      jsonb_build_object('run_status', p_status),
      p_reason);
  end if;
end;
$$;

revoke execute on function public.move_draw_row(uuid, text) from anon;
revoke execute on function public.set_run_status(uuid, text, text) from anon;
