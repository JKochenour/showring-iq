import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { Card } from "@/components/ui";
import { loadValidatedEntries } from "@/lib/validate-entries";
import { loadMissingPaperworkSummary } from "@/lib/load-missing-paperwork";
import { loadNrhaExportData } from "@/lib/load-nrha-export";
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

  const [
    { data: show },
    { data: staff },
    { count: classCount },
    { entries: validatedEntries },
    paperwork,
  ] = await Promise.all([
    supabase.from("shows").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("show_staff")
      .select("id, display_name, staff_role")
      .eq("show_id", id)
      .order("created_at"),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("show_id", id),
    loadValidatedEntries(supabase, id),
    loadMissingPaperworkSummary(supabase, id),
  ]);

  const activeEntries = validatedEntries.filter(
    (v) => v.entry.status === "active"
  );
  const entryCount = activeEntries.length;
  const checkedInCount = activeEntries.filter(
    (v) => v.entry.checked_in_at
  ).length;
  const issueCount = activeEntries.reduce(
    (sum, v) =>
      sum + v.issues.filter((issue) => issue.severity !== "info").length,
    0
  );
  const paperworkIssueCount =
    paperwork.ridersWithNoDocs +
    paperwork.horsesWithNoDocs +
    paperwork.pendingCount +
    paperwork.expiredCount;

  if (!show) notFound();
  const s = show as Show;
  const staffRows = (staff as Pick<ShowStaffRow, "id" | "display_name" | "staff_role">[]) ?? [];
  const roleLabel = (value: string) =>
    STAFF_ROLES.find((r) => r.value === value)?.label ?? value;

  const canExport = await hasOrgPermission(s.organization_id, "result.export");
  const nrhaData = canExport ? await loadNrhaExportData(supabase, id) : null;

  const days =
    Math.round(
      (new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) /
        86_400_000
    ) + 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <p className="text-sm text-stone-500 dark:text-stone-400">Dates</p>
        <p className="mt-1 font-semibold">{formatDate(s.start_date)}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          through {formatDate(s.end_date)} · {days} day{days === 1 ? "" : "s"}
        </p>
      </Card>
      <Card>
        <p className="text-sm text-stone-500 dark:text-stone-400">Venue</p>
        <p className="mt-1 font-semibold">{s.venue_name ?? "Not set"}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {s.city ? `${s.city}${s.state ? `, ${s.state}` : ""}` : "—"}
        </p>
      </Card>
      <Link href={`/shows/${id}/staff`}>
        <Card className="h-full transition-colors hover:border-brand-600">
          <p className="text-sm text-stone-500 dark:text-stone-400">Staff</p>
          <p className="mt-1 text-lg font-semibold">{staffRows.length}</p>
          <p className="truncate text-sm text-stone-500 dark:text-stone-400">
            {staffRows.length > 0
              ? staffRows
                  .slice(0, 3)
                  .map((m) => `${m.display_name} (${roleLabel(m.staff_role)})`)
                  .join(", ") + (staffRows.length > 3 ? ", …" : "")
              : "No staff assigned yet"}
          </p>
        </Card>
      </Link>
      <Link href={`/shows/${id}/classes`}>
        <Card className="h-full transition-colors hover:border-brand-600">
          <p className="text-sm text-stone-500 dark:text-stone-400">Classes</p>
          <p className="mt-1 text-lg font-semibold">{classCount ?? 0}</p>
        </Card>
      </Link>
      <Link href={`/shows/${id}/entries`}>
        <Card className="h-full transition-colors hover:border-brand-600">
          <p className="text-sm text-stone-500 dark:text-stone-400">Entries</p>
          <p className="mt-1 text-lg font-semibold">{entryCount}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {checkedInCount} checked in
          </p>
        </Card>
      </Link>
      <Link href={`/shows/${id}/issues`}>
        <Card
          className={`h-full transition-colors hover:border-brand-600 ${
            issueCount > 0 ? "border-amber-300 dark:border-amber-800" : ""
          }`}
        >
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Validation issues
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${
              issueCount > 0 ? "text-amber-700 dark:text-amber-400" : ""
            }`}
          >
            {issueCount}
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            warnings &amp; blockers
          </p>
        </Card>
      </Link>
      <Card
        className={
          paperworkIssueCount > 0 ? "border-amber-300 dark:border-amber-800" : ""
        }
      >
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Missing paperwork
        </p>
        {paperworkIssueCount === 0 ? (
          <p className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-400">
            All paperwork verified
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-sm text-amber-700 dark:text-amber-400">
            {paperwork.ridersWithNoDocs > 0 && (
              <li>
                {paperwork.ridersWithNoDocs} rider entr
                {paperwork.ridersWithNoDocs === 1 ? "y" : "ies"} with no documents
                on file
              </li>
            )}
            {paperwork.horsesWithNoDocs > 0 && (
              <li>
                {paperwork.horsesWithNoDocs} horse entr
                {paperwork.horsesWithNoDocs === 1 ? "y" : "ies"} with no documents
                on file
              </li>
            )}
            {paperwork.pendingCount > 0 && (
              <li>
                {paperwork.pendingCount} document
                {paperwork.pendingCount === 1 ? "" : "s"} awaiting verification
              </li>
            )}
            {paperwork.expiredCount > 0 && (
              <li>
                {paperwork.expiredCount} expired document
                {paperwork.expiredCount === 1 ? "" : "s"}
              </li>
            )}
          </ul>
        )}
      </Card>
      <Link href={`/shows/${id}/exports`}>
        <Card
          className={`h-full transition-colors hover:border-brand-600 ${
            nrhaData && !nrhaData.ready ? "border-amber-300 dark:border-amber-800" : ""
          }`}
        >
          <p className="text-sm text-stone-500 dark:text-stone-400">
            NRHA export readiness
          </p>
          {!canExport ? (
            <p className="mt-1 text-sm text-stone-400">
              Requires the result.export permission
            </p>
          ) : nrhaData!.ready ? (
            <p className="mt-1 text-lg font-semibold text-brand-700 dark:text-brand-400">
              Ready
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-400">
              {nrhaData!.readiness.length} issue
              {nrhaData!.readiness.length === 1 ? "" : "s"}
            </p>
          )}
        </Card>
      </Link>
      {s.description && (
        <Card className="sm:col-span-2 lg:col-span-3">
          <p className="text-sm text-stone-500 dark:text-stone-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{s.description}</p>
        </Card>
      )}
    </div>
  );
}
