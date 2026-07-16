-- ============================================================
-- ShowRing IQ — Public schedule grouping
--
-- The public show page listed every class as one flat chip cloud —
-- unreadable for a real show (Fire Cracker Classic: 60+ classes).
-- Expose scheduled_date and concurrent_group_id through
-- public_show_classes so the page can group classes by day and merge
-- concurrent classes into one run row, the way the printed show bill
-- reads. Both fields are schedule-shape data, safe for guests;
-- concurrent_group_id is an opaque grouping uuid.
--
-- Return-type change requires drop + recreate (same body otherwise).
-- ============================================================

drop function if exists public.public_show_classes(uuid);

create function public.public_show_classes(p_show uuid)
returns table (
  id uuid,
  class_number integer,
  name text,
  display_order integer,
  status text,
  scheduled_date date,
  concurrent_group_id uuid
)
language sql
security definer
stable
set search_path = ''
as $$
  select c.id, c.class_number, c.name, c.display_order, c.status,
         c.scheduled_date, c.concurrent_group_id
  from public.classes c
  join public.shows s on s.id = c.show_id
  where c.show_id = p_show
    and s.status = 'published'
  order by c.display_order;
$$;

grant execute on function public.public_show_classes(uuid) to anon, authenticated;
