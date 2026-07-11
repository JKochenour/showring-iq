import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScheduleClassRow {
  id: string;
  classNumber: number;
  name: string;
  status: string;
  entryCount: number;
  avgRunMinutes: number;
  dragEveryN: number | null;
  durationMinutes: number;
  /** "1:40 PM" style, or null for unscheduled classes. */
  estimatedStart: string | null;
}

export interface ScheduleDay {
  date: string;
  classes: ScheduleClassRow[];
}

export interface ShowSchedule {
  days: ScheduleDay[];
  unscheduled: ScheduleClassRow[];
}

interface RawClass {
  id: string;
  class_number: number;
  name: string;
  status: string;
  scheduled_date: string | null;
  avg_run_minutes: number;
  drag_every_n: number | null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Wraps past midnight defensively rather than printing "26:15". */
function formatMinutesAsClock(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * A rolling day-sheet: estimated start = day start + every earlier
 * class that day's (entries × avg run time + drag pauses) + a break
 * between each class. No ring/arena assignment, no true conflict
 * detection — deliberately the lighter-weight version of CLAUDE.md's
 * Scheduling workflow, recomputed fresh from current data on every
 * load rather than tracking actual elapsed pace per run.
 */
export async function loadShowSchedule(
  supabase: SupabaseClient,
  showId: string
): Promise<ShowSchedule> {
  const [{ data: show }, { data: classes }, { data: entryClasses }] =
    await Promise.all([
      supabase
        .from("shows")
        .select("schedule_start_time, schedule_break_minutes, schedule_drag_minutes")
        .eq("id", showId)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("id, class_number, name, status, scheduled_date, avg_run_minutes, drag_every_n")
        .eq("show_id", showId)
        .order("display_order"),
      supabase.from("entry_classes").select("class_id, status").eq("show_id", showId),
    ]);

  const entryCountByClass = new Map<string, number>();
  for (const ec of (entryClasses as { class_id: string; status: string }[]) ?? []) {
    if (ec.status !== "entered") continue;
    entryCountByClass.set(ec.class_id, (entryCountByClass.get(ec.class_id) ?? 0) + 1);
  }

  const startMinutes = timeToMinutes((show?.schedule_start_time as string) ?? "08:00");
  const breakMinutes = (show?.schedule_break_minutes as number) ?? 10;
  const dragMinutes = (show?.schedule_drag_minutes as number) ?? 5;

  const allClasses = (classes as RawClass[]) ?? [];
  const byDate = new Map<string, RawClass[]>();
  const unscheduled: ScheduleClassRow[] = [];

  for (const cls of allClasses) {
    if (!cls.scheduled_date) {
      const entryCount = entryCountByClass.get(cls.id) ?? 0;
      unscheduled.push({
        id: cls.id,
        classNumber: cls.class_number,
        name: cls.name,
        status: cls.status,
        entryCount,
        avgRunMinutes: cls.avg_run_minutes,
        dragEveryN: cls.drag_every_n,
        durationMinutes: 0,
        estimatedStart: null,
      });
      continue;
    }
    const list = byDate.get(cls.scheduled_date) ?? [];
    list.push(cls);
    byDate.set(cls.scheduled_date, list);
  }

  const days: ScheduleDay[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayClasses]) => {
      let cursor = startMinutes;
      const rows = dayClasses.map((cls) => {
        const entryCount = entryCountByClass.get(cls.id) ?? 0;
        const dragCount = cls.drag_every_n ? Math.floor(entryCount / cls.drag_every_n) : 0;
        const durationMinutes = entryCount * cls.avg_run_minutes + dragCount * dragMinutes;
        const estimatedStart = formatMinutesAsClock(cursor);
        cursor += durationMinutes + breakMinutes;
        return {
          id: cls.id,
          classNumber: cls.class_number,
          name: cls.name,
          status: cls.status,
          entryCount,
          avgRunMinutes: cls.avg_run_minutes,
          dragEveryN: cls.drag_every_n,
          durationMinutes,
          estimatedStart,
        };
      });
      return { date, classes: rows };
    });

  unscheduled.sort((a, b) => a.classNumber - b.classNumber);

  return { days, unscheduled };
}
