-- 00052: remove a weekend when its last show is deleted.
--
-- BUG (found 2026-07-16 during live QA): deleting every show of a
-- weekend leaves the show_weekends row behind with zero slates. The
-- weekends LIST only surfaces weekends via their shows, so the orphan
-- is invisible in the UI — but its weekend_back_numbers rows still
-- reference horses, so deleting one of those horses fails with the
-- misleading "This horse has show entries and can't be deleted"
-- (it has no entries; it has an orphaned weekend back number the
-- office cannot see or clear).
--
-- Fix: an AFTER DELETE trigger on shows drops any weekend that no
-- longer has shows (weekend_back_numbers cascade with it), plus a
-- one-off cleanup of orphans that already exist.

create or replace function public.cleanup_empty_weekend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.show_weekends w
  where w.id = old.weekend_id
    and not exists (select 1 from public.shows s where s.weekend_id = w.id);
  return old;
end;
$$;

drop trigger if exists shows_cleanup_empty_weekend on public.shows;
create trigger shows_cleanup_empty_weekend
  after delete on public.shows
  for each row
  when (old.weekend_id is not null)
  execute function public.cleanup_empty_weekend();

-- One-off: remove weekends that are already orphaned (no shows).
delete from public.show_weekends w
where not exists (select 1 from public.shows s where s.weekend_id = w.id);

-- Verification (should return zero rows):
-- select w.id, w.name from public.show_weekends w
-- where not exists (select 1 from public.shows s where s.weekend_id = w.id);
