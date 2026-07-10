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

  const rows = (shows as Show[]) ?? [];

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
              <Card className="h-full transition-colors hover:border-emerald-600">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{show.name}</h3>
                  <StatusBadge status={show.status} />
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatDateRange(show.start_date, show.end_date)}
                </p>
                {(show.venue_name || show.city) && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
    </div>
  );
}
