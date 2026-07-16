-- ============================================================
-- ShowRing IQ — Per-class arena
--
-- Real show bills split each day by arena ("Thursday INDOOR",
-- "Friday COVERED") and two arenas run in parallel. Classes only had a
-- scheduled_date, so day sheets and the public schedule couldn't split
-- Indoor/Covered — and the show-bill parser already extracts the arena
-- from session headers with nowhere to store it.
--
-- Free-text per class (like venue_name on shows) rather than a lookup
-- table: CLAUDE.md's show_arenas infrastructure was never built and a
-- label is all the schedule needs. Classes RLS policies are row-level
-- (class.edit), so no new grant is required.
-- ============================================================

alter table public.classes
  add column arena text check (char_length(arena) <= 80);

comment on column public.classes.arena is
  'Free-text arena label from the show bill (e.g. INDOOR, COVERED). '
  'Schedules group by scheduled_date + arena; arenas run in parallel.';

-- Expose it publicly (return-type change requires drop + recreate).
drop function if exists public.public_show_classes(uuid);

create function public.public_show_classes(p_show uuid)
returns table (
  id uuid,
  class_number integer,
  name text,
  display_order integer,
  status text,
  scheduled_date date,
  concurrent_group_id uuid,
  arena text
)
language sql
security definer
stable
set search_path = ''
as $$
  select c.id, c.class_number, c.name, c.display_order, c.status,
         c.scheduled_date, c.concurrent_group_id, c.arena
  from public.classes c
  join public.shows s on s.id = c.show_id
  where c.show_id = p_show
    and s.status = 'published'
  order by c.display_order;
$$;

grant execute on function public.public_show_classes(uuid) to anon, authenticated;
