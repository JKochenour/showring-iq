import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { StatusBadge } from "@/components/show/show-status-actions";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Show } from "@/lib/types";

export const metadata = { title: "Shows — ShowRing IQ" };

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export default async function OrgShowsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: org }, { data: shows }, canCreate] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("shows")
      .select("*")
      .eq("organization_id", id)
      .order("start_date", { ascending: false }),
    hasOrgPermission(id, "show.create"),
  ]);

  if (!org) notFound();

  // Archived shows stay fully readable — they are just kept out of the
  // working list, which is the point of archiving them.
  const allRows = (shows as Show[]) ?? [];
  const rows = allRows.filter((s) => s.status !== "archived");
  const archivedRows = allRows.filter((s) => s.status === "archived");

  return (
    <div>
      <PageHeader
        title="Shows"
        description="All shows produced by this organization."
        action={
          canCreate ? (
            <ButtonLink href={`/organizations/${id}/shows/new`}>
              New show
            </ButtonLink>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No shows yet"
          description="Create the first show to start configuring staff, classes, and entries."
          action={
            canCreate ? (
              <ButtonLink href={`/organizations/${id}/shows/new`}>
                Create show
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((show) => (
            <Link key={show.id} href={`/shows/${show.id}/dashboard`}>
              <Card className="h-full transition-colors hover:border-brand-600">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{show.name}</h3>
                  <StatusBadge status={show.status} />
                </div>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {formatDateRange(show.start_date, show.end_date)}
                </p>
                {(show.venue_name || show.city) && (
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {[show.venue_name, show.city, show.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Kept out of the working list above, but still open to read, print,
          and export. Restore one to draft (Settings → Status & lifecycle)
          to make a correction, then archive it again. */}
      {archivedRows.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100">
            Archived shows ({archivedRows.length})
          </summary>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Still saved in full — results, bills, and exports stay readable.
            To change something, open the show and restore it to draft from
            its settings, then archive it again.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {archivedRows.map((show) => (
              <Link key={show.id} href={`/shows/${show.id}/dashboard`}>
                <Card className="h-full opacity-75 transition-colors hover:border-brand-600 hover:opacity-100">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{show.name}</h3>
                    <StatusBadge status={show.status} />
                  </div>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {formatDateRange(show.start_date, show.end_date)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
