import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { Card } from "@/components/ui";
import { STAFF_ROLES } from "@/lib/validation/show";
import type { Show, ShowStaffRow } from "@/lib/types";

export const metadata = { title: "Show dashboard — ShowRing IQ" };

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ShowDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: show }, { data: staff }] = await Promise.all([
    supabase.from("shows").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("show_staff")
      .select("id, display_name, staff_role")
      .eq("show_id", id)
      .order("created_at"),
  ]);

  if (!show) notFound();
  const s = show as Show;
  const staffRows = (staff as Pick<ShowStaffRow, "id" | "display_name" | "staff_role">[]) ?? [];
  const roleLabel = (value: string) =>
    STAFF_ROLES.find((r) => r.value === value)?.label ?? value;

  const days =
    Math.round(
      (new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) /
        86_400_000
    ) + 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Dates</p>
        <p className="mt-1 font-semibold">{formatDate(s.start_date)}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          through {formatDate(s.end_date)} · {days} day{days === 1 ? "" : "s"}
        </p>
      </Card>
      <Card>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Venue</p>
        <p className="mt-1 font-semibold">{s.venue_name ?? "Not set"}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {s.city ? `${s.city}${s.state ? `, ${s.state}` : ""}` : "—"}
        </p>
      </Card>
      <Link href={`/shows/${id}/staff`}>
        <Card className="h-full transition-colors hover:border-emerald-600">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Staff</p>
          <p className="mt-1 text-lg font-semibold">{staffRows.length}</p>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {staffRows.length > 0
              ? staffRows
                  .slice(0, 3)
                  .map((m) => `${m.display_name} (${roleLabel(m.staff_role)})`)
                  .join(", ") + (staffRows.length > 3 ? ", …" : "")
              : "No staff assigned yet"}
          </p>
        </Card>
      </Link>
      <Card className="border-dashed">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Classes</p>
        <p className="mt-1 text-lg font-semibold text-zinc-400">Sprint 3</p>
      </Card>
      <Card className="border-dashed">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Entries</p>
        <p className="mt-1 text-lg font-semibold text-zinc-400">Sprint 5</p>
      </Card>
      <Card className="border-dashed">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Export readiness
        </p>
        <p className="mt-1 text-lg font-semibold text-zinc-400">Sprint 10</p>
      </Card>
      {s.description && (
        <Card className="sm:col-span-2 lg:col-span-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{s.description}</p>
        </Card>
      )}
    </div>
  );
}
