import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { loadValidatedEntries } from "@/lib/validate-entries";
import {
  VALIDATION_DISCLAIMER,
  type Severity,
} from "@/lib/validation-engine";
import { IssueList } from "@/components/show/issue-badges";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Issues — ShowRing IQ" };

const SEVERITIES: { key: Severity; label: string; tone: string }[] = [
  {
    key: "critical",
    label: "Critical",
    tone: "text-red-700 dark:text-red-400",
  },
  {
    key: "blocking",
    label: "Blocking",
    tone: "text-red-700 dark:text-red-400",
  },
  {
    key: "warning",
    label: "Warnings",
    tone: "text-amber-700 dark:text-amber-400",
  },
  { key: "info", label: "Info", tone: "text-blue-700 dark:text-blue-400" },
];

export default async function IssuesPage({
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

  const { entries } = await loadValidatedEntries(supabase, id);

  const counts: Record<Severity, number> = {
    critical: 0,
    blocking: 0,
    warning: 0,
    info: 0,
  };
  for (const v of entries) {
    for (const issue of v.issues) counts[issue.severity] += 1;
  }

  const withIssues = entries.filter((v) => v.issues.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validation issues"
        description="Missing memberships, licenses, back numbers, and info flags across all active entries. Checks run continuously — fix issues before they reach the export."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {SEVERITIES.map((s) => (
          <Card key={s.key}>
            <p className="text-sm text-stone-500 dark:text-stone-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${counts[s.key] > 0 ? s.tone : ""}`}>
              {counts[s.key]}
            </p>
          </Card>
        ))}
      </div>

      {withIssues.length === 0 ? (
        <EmptyState
          title="No validation issues"
          description="Every active entry passes the configured checks."
        />
      ) : (
        <div className="space-y-4">
          {withIssues.map(({ entry, backNumber, issues }) => (
            <Card key={entry.id}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/shows/${id}/entries/${entry.id}`}
                  className="font-medium text-brand-700 hover:underline dark:text-brand-500"
                >
                  Entry {entry.entry_number}
                  {backNumber && ` · #${backNumber}`} — {entry.rider_name} on{" "}
                  {entry.horse_name}
                </Link>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {issues.length} issue{issues.length === 1 ? "" : "s"}
                </span>
              </div>
              <IssueList issues={issues} />
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-400">{VALIDATION_DISCLAIMER}</p>
    </div>
  );
}
