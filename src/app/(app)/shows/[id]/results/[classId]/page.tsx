import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { formatScore } from "@/lib/score";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import {
  OverridePlacingButton,
  ResultsClassActions,
} from "@/components/show/results-controls";
import { PayoutActions, PayoutScheduleEditor } from "@/components/show/payout-controls";
import { TieResolutionCard } from "@/components/show/tie-resolution-card";
import { Card, EmptyState } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { Result, Score, ShowClass } from "@/lib/types";

export const metadata = { title: "Class results — ShowRing IQ" };

interface ResultRow {
  entryClassId: string;
  entryNumber: number;
  riderName: string;
  horseName: string;
  backNumber: number | null;
  score: Score | null;
  result: Result | null;
}

export default async function ClassResultsPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const { supabase } = await requireUser();

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("show_id", id)
    .maybeSingle();
  if (!cls) notFound();
  const showClass = cls as ShowClass;

  const [
    { data: entryClasses },
    { data: scores },
    { data: results },
    { data: backNumbers },
    canPublish,
    canUnpublish,
    canCalculatePayouts,
    canApprovePayouts,
    canEditClass,
  ] = await Promise.all([
    supabase
      .from("entry_classes")
      .select("id, entry:entries(id, entry_number, rider_name, horse_name)")
      .eq("class_id", classId)
      .eq("status", "entered"),
    supabase.from("scores").select("*").eq("class_id", classId),
    supabase.from("results").select("*").eq("class_id", classId),
    supabase.from("back_numbers").select("entry_id, number").eq("show_id", id),
    hasOrgPermission(showClass.organization_id, "result.publish"),
    hasOrgPermission(showClass.organization_id, "result.unpublish"),
    hasOrgPermission(showClass.organization_id, "payout.calculate"),
    hasOrgPermission(showClass.organization_id, "payout.approve"),
    hasOrgPermission(showClass.organization_id, "class.edit"),
  ]);

  const scoreByEntryClass = new Map<string, Score>();
  for (const s of (scores as Score[]) ?? []) scoreByEntryClass.set(s.entry_class_id, s);
  const resultByEntryClass = new Map<string, Result>();
  for (const r of (results as Result[]) ?? []) resultByEntryClass.set(r.entry_class_id, r);
  const backByEntry = new Map<string, number>();
  for (const bn of backNumbers ?? []) backByEntry.set(bn.entry_id, bn.number);

  const rows: ResultRow[] =
    entryClasses?.map((ec) => {
      const entry = ec.entry as unknown as {
        id: string;
        entry_number: number;
        rider_name: string;
        horse_name: string;
      } | null;
      return {
        entryClassId: ec.id as string,
        entryNumber: entry?.entry_number ?? 0,
        riderName: entry?.rider_name ?? "Unknown",
        horseName: entry?.horse_name ?? "Unknown",
        backNumber: entry ? (backByEntry.get(entry.id) ?? null) : null,
        score: scoreByEntryClass.get(ec.id as string) ?? null,
        result: resultByEntryClass.get(ec.id as string) ?? null,
      };
    }) ?? [];

  rows.sort((a, b) => {
    const ap = a.result?.placing ?? 9999;
    const bp = b.result?.placing ?? 9999;
    if (ap !== bp) return ap - bp;
    return (b.score?.total_score_tenths ?? -1) - (a.score?.total_score_tenths ?? -1);
  });

  const hasResults = rows.some((r) => r.result !== null);
  const firstPlaceTie = rows.filter(
    (r) => r.result?.placing === 1 && r.result?.tie_status === "tied"
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/results`} className="hover:underline">
            Results
          </Link>{" "}
          / Class {showClass.class_number}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Class {showClass.class_number} — {showClass.name}
          </h2>
          <ClassStatusBadge status={showClass.status} />
        </div>
      </div>

      <Card>
        <ResultsClassActions
          classId={classId}
          showId={id}
          classStatus={showClass.status}
          hasResults={hasResults}
          canPublish={canPublish}
          canUnpublish={canUnpublish}
        />
      </Card>

      {firstPlaceTie.length > 1 && (
        <TieResolutionCard
          showId={id}
          classId={classId}
          representativeEntryClassId={firstPlaceTie[0].entryClassId}
          tiedNames={firstPlaceTie.map((r) => r.riderName)}
          resolution={firstPlaceTie[0].result?.tie_resolution ?? null}
          resolutionNote={firstPlaceTie[0].result?.tie_resolution_note ?? null}
          canResolve={canPublish}
        />
      )}

      <Card>
        <h3 className="mb-3 text-base font-semibold">Payouts</h3>
        <PayoutScheduleEditor
          classId={classId}
          showId={id}
          retainagePercent={showClass.retainage_percent}
          schedule={showClass.payout_schedule}
          canEdit={canEditClass}
        />
        {hasResults && (
          <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
            <PayoutActions
              classId={classId}
              showId={id}
              canCalculate={canCalculatePayouts}
              canApprove={canApprovePayouts}
            />
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No entries" description="Nothing to place in this class." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Placing</th>
                  <th className="py-2 pr-4 font-medium">Back #</th>
                  <th className="py-2 pr-4 font-medium">Rider / Horse</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 pr-4 font-medium">Money won</th>
                  {canPublish && <th className="py-2 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {rows.map((row) => (
                  <tr key={row.entryClassId}>
                    <td className="py-3 pr-4">
                      {row.result?.placing ? (
                        <span className="font-mono text-lg font-bold">
                          {row.result.placing}
                          {row.result.tie_status === "tied" && (
                            <span className="ml-1 text-xs font-normal text-amber-600 dark:text-amber-400">
                              (tie)
                            </span>
                          )}
                          {row.result.manual_override && (
                            <span className="ml-1 text-xs font-normal text-stone-400">
                              (override)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      {row.backNumber ? `#${row.backNumber}` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.riderName}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {row.horseName}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      {row.score
                        ? row.score.result_status === "shown" ||
                          row.score.result_status === "zero"
                          ? formatScore(row.score.total_score_tenths)
                          : row.score.result_status
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      {row.result && row.result.money_won_cents > 0
                        ? formatCents(row.result.money_won_cents)
                        : "—"}
                    </td>
                    {canPublish && (
                      <td className="py-3">
                        <OverridePlacingButton
                          entryClassId={row.entryClassId}
                          showId={id}
                          classId={classId}
                          currentPlacing={row.result?.placing ?? null}
                        />
                      </td>
                    )}
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
