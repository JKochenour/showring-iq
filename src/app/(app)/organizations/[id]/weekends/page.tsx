import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { StatusBadge } from "@/components/show/show-status-actions";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { ShowStatus } from "@/lib/types";

export const metadata = { title: "Weekends — ShowRing IQ" };

type WeekendRow = {
  id: string;
  name: string;
  shows: { id: string; name: string; status: ShowStatus; start_date: string }[] | null;
};

export default async function WeekendsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: org }, { data: weekends }, canCreate] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("show_weekends")
      .select("id, name, shows:shows(id, name, status, start_date)")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    hasOrgPermission(id, "show.create"),
  ]);

  if (!org) notFound();

  // Only surface real multi-slate weekends. A standalone show gets an
  // auto-created weekend-of-one that's an implementation detail, not
  // something the office thinks of as a "weekend."
  const rows = ((weekends as WeekendRow[]) ?? []).filter(
    (w) => (w.shows?.length ?? 0) >= 2
  );

  return (
    <div>
      <PageHeader
        title="Weekends"
        description="A weekend runs the same classes as two-plus slates — a horse keeps one back number across every slate, office/stall/drug is charged once, and each slate still submits its own NRHA file."
        action={
          canCreate ? (
            <ButtonLink href={`/organizations/${id}/weekends/new`}>
              New weekend
            </ButtonLink>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No weekends yet"
          description="Group two shows (the slates) into a weekend to enter horses across both at once and bill each person a single consolidated total."
          action={
            canCreate ? (
              <ButtonLink href={`/organizations/${id}/weekends/new`}>
                Create a weekend
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((w) => {
            const slates = (w.shows ?? [])
              .slice()
              .sort((a, b) => a.start_date.localeCompare(b.start_date));
            return (
              <Link key={w.id} href={`/organizations/${id}/weekends/${w.id}`}>
                <Card className="h-full transition-colors hover:border-brand-600">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{w.name}</h3>
                    <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                      {slates.length} slates
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {slates.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 text-sm text-stone-600 dark:text-stone-300"
                      >
                        <span>{s.name}</span>
                        <StatusBadge status={s.status} />
                      </li>
                    ))}
                  </ul>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
