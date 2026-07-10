import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadValidatedEntries } from "@/lib/validate-entries";
import { hasBlockingIssues } from "@/lib/validation-engine";
import { CheckInButton } from "@/components/show/check-in-button";
import { IssueSummaryBadges } from "@/components/show/issue-badges";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Check-in — ShowRing IQ" };

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const [{ entries }, canCheckIn] = await Promise.all([
    loadValidatedEntries(supabase, id),
    hasOrgPermission(show.organization_id, "entry.check_in"),
  ]);

  const active = entries.filter((v) => v.entry.status === "active");
  const checkedInCount = active.filter((v) => v.entry.checked_in_at).length;

  return (
    <div>
      <PageHeader
        title="Check-in"
        description={`${checkedInCount} of ${active.length} active entries checked in. Blocking issues require an override reason (audited).`}
      />

      {active.length === 0 ? (
        <EmptyState
          title="No active entries"
          description="Entries appear here once they're created."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Back #</th>
                  <th className="py-2 pr-4 font-medium">Entry</th>
                  <th className="py-2 pr-4 font-medium">Rider / Horse</th>
                  <th className="py-2 pr-4 font-medium">Classes</th>
                  <th className="py-2 pr-4 font-medium">Validation</th>
                  <th className="py-2 font-medium">Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {active.map(({ entry, backNumber, enteredClassCount, issues }) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-4 font-mono font-semibold">
                      {backNumber ? `#${backNumber}` : "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono">{entry.entry_number}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{entry.rider_name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {entry.horse_name}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{enteredClassCount}</td>
                    <td className="py-3 pr-4">
                      <IssueSummaryBadges issues={issues} />
                    </td>
                    <td className="py-3">
                      {entry.checked_in_at ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            ✓{" "}
                            {new Date(entry.checked_in_at).toLocaleTimeString(
                              [],
                              { hour: "numeric", minute: "2-digit" }
                            )}
                          </span>
                          {canCheckIn && (
                            <CheckInButton
                              entryId={entry.id}
                              checkedIn
                              blockingMessages={[]}
                            />
                          )}
                        </div>
                      ) : canCheckIn ? (
                        <CheckInButton
                          entryId={entry.id}
                          checkedIn={false}
                          blockingMessages={issues
                            .filter(
                              (i) =>
                                i.severity === "blocking" ||
                                i.severity === "critical"
                            )
                            .map((i) => i.message)}
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {hasBlockingIssues(issues) ? "blocked" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
