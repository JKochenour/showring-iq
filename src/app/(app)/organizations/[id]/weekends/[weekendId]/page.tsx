import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { StatusBadge } from "@/components/show/show-status-actions";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import type { ShowStatus } from "@/lib/types";

export const metadata = { title: "Circuit — ShowRing IQ" };

export default async function WeekendHubPage({
  params,
}: {
  params: Promise<{ id: string; weekendId: string }>;
}) {
  const { id, weekendId } = await params;
  const { supabase } = await requireUser();

  const [{ data: weekend }, canEnter] = await Promise.all([
    supabase
      .from("show_weekends")
      .select("id, name, organization_id, shows:shows(id, name, status, start_date)")
      .eq("id", weekendId)
      .maybeSingle(),
    hasOrgPermission(id, "entry.create"),
  ]);

  if (!weekend || weekend.organization_id !== id) notFound();

  const slates = (
    (weekend.shows as { id: string; name: string; status: ShowStatus; start_date: string }[]) ??
    []
  )
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="space-y-6">
      <PageHeader
        title={weekend.name}
        description="Enter horses across every slate from one screen; each keeps one back number for the circuit and one consolidated bill. Scoring, results, and the NRHA export stay on each slate."
        action={
          canEnter && slates.length > 0 ? (
            <ButtonLink href={`/organizations/${id}/weekends/${weekendId}/entries/new`}>
              New circuit entry
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Slates</h3>
          <ul className="space-y-2">
            {slates.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800"
              >
                <div>
                  <span className="mr-2 font-mono text-xs text-stone-400">
                    Slate {i + 1}
                  </span>
                  <Link
                    href={`/shows/${s.id}/dashboard`}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={s.status} />
                  <Link
                    href={`/shows/${s.id}/entries`}
                    className="text-sm text-brand-700 hover:underline dark:text-brand-400"
                  >
                    Entries →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">This circuit</h3>
          <div className="space-y-2 text-sm">
            <Link
              href={`/organizations/${id}/weekends/${weekendId}/manage`}
              className="block rounded-md border border-stone-200 px-3 py-2 hover:border-brand-600 dark:border-stone-800"
            >
              Manage entries by back number →
            </Link>
            <Link
              href={`/organizations/${id}/weekends/${weekendId}/entries/new`}
              className="block rounded-md border border-stone-200 px-3 py-2 hover:border-brand-600 dark:border-stone-800"
            >
              New circuit entry →
            </Link>
            <Link
              href={`/organizations/${id}/weekends/${weekendId}/financials`}
              className="block rounded-md border border-stone-200 px-3 py-2 hover:border-brand-600 dark:border-stone-800"
            >
              Consolidated billing →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
