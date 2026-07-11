import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { loadShowSchedule, type ScheduleClassRow } from "@/lib/schedule";
import { AutoRefresh } from "@/components/auto-refresh";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { ClassStatus } from "@/lib/types";

export const metadata = { title: "Schedule — ShowRing IQ" };

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const schedule = await loadShowSchedule(supabase, id);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Schedule"
        description="Estimated start times = entries × avg run time + drag pauses + a break between classes. Recalculates from current entries/scratches on every load — treat these as estimates, not guarantees."
      />

      {schedule.days.length === 0 && schedule.unscheduled.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Add classes and give them a scheduled day to see estimated start times here."
        />
      ) : (
        <>
          {schedule.days.map((day) => (
            <Card key={day.date}>
              <h3 className="mb-3 text-base font-semibold">
                {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <ScheduleTable showId={id} rows={day.classes} />
            </Card>
          ))}

          {schedule.unscheduled.length > 0 && (
            <Card>
              <h3 className="mb-1 text-base font-semibold">Not yet scheduled</h3>
              <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
                Give these a scheduled day (on the class&apos;s edit page) to
                get an estimated start time.
              </p>
              <ScheduleTable showId={id} rows={schedule.unscheduled} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleTable({
  showId,
  rows,
}: {
  showId: string;
  rows: ScheduleClassRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
            <th className="py-2 pr-4">Start</th>
            <th className="py-2 pr-4">Class</th>
            <th className="py-2 pr-4">Entries</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-2 pr-4 font-mono">{row.estimatedStart ?? "—"}</td>
              <td className="py-2 pr-4">
                <Link
                  href={`/shows/${showId}/classes/${row.id}`}
                  className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  {row.classNumber} — {row.name}
                </Link>
              </td>
              <td className="py-2 pr-4">{row.entryCount}</td>
              <td className="py-2">
                <ClassStatusBadge status={row.status as ClassStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
