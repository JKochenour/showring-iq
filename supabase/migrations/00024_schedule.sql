-- ============================================================
-- ShowRing IQ — Schedule with estimated start times
-- A simple rolling day-sheet: estimated start time per class =
-- day start + sum of every earlier class that day's (entries × avg
-- run time + drag pauses + a break). No arena/ring assignment and no
-- true conflict detection (CLAUDE.md already notes that
-- infrastructure was never built) — this is deliberately the
-- lighter-weight version the roadmap called for.
-- ============================================================

alter table public.shows
  add column schedule_start_time time not null default '08:00:00',
  add column schedule_break_minutes integer not null default 10 check (schedule_break_minutes >= 0),
  add column schedule_drag_minutes integer not null default 5 check (schedule_drag_minutes >= 0);

grant update (schedule_start_time, schedule_break_minutes, schedule_drag_minutes)
  on public.shows to authenticated;

alter table public.classes
  add column avg_run_minutes numeric(5, 1) not null default 3.0 check (avg_run_minutes > 0);
