import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadNrhaExportData } from "@/lib/load-nrha-export";
import { loadShowResults } from "@/lib/load-show-results";
import { formatCents } from "@/lib/money";
import { IssueList } from "@/components/show/issue-badges";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Exports — ShowRing IQ" };

export default async function ExportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const canExport = await hasOrgPermission(show.organization_id, "result.export");
  const [nrhaData, resultsData] = canExport
    ? await Promise.all([
        loadNrhaExportData(supabase, id),
        loadShowResults(supabase, id),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exports"
        description="NRHA ReinerSuite CSV and PDF results. A class must be marked official (Scoring tab) to be included in either."
      />

      {!canExport ? (
        <Alert tone="info">
          You don&apos;t have the result.export permission in this organization.
        </Alert>
      ) : (
        <>
          <Card
            className={
              nrhaData!.ready
                ? "border-brand-300 dark:border-brand-800"
                : "border-amber-300 dark:border-amber-800"
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  NRHA Submission:{" "}
                  <span
                    className={
                      nrhaData!.ready
                        ? "text-brand-700 dark:text-brand-400"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {nrhaData!.ready
                      ? "Ready"
                      : `${nrhaData!.readiness.length} issue${nrhaData!.readiness.length === 1 ? "" : "s"}`}
                  </span>
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {nrhaData!.includedClassCount} class
                  {nrhaData!.includedClassCount === 1 ? "" : "es"} included ·{" "}
                  {nrhaData!.rows.length} row{nrhaData!.rows.length === 1 ? "" : "s"}
                </p>
              </div>
              {nrhaData!.ready && (
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/shows/${id}/exports/nrha-csv`} variant="secondary">
                    Download CSV only
                  </ButtonLink>
                  <ButtonLink href={`/shows/${id}/exports/nrha-package`}>
                    Download full package (.zip)
                  </ButtonLink>
                </div>
              )}
            </div>
            {nrhaData!.readiness.length > 0 ? (
              <IssueList issues={nrhaData!.readiness} />
            ) : (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Every check passed.
              </p>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">PDF results</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Placings and scores for every official class, one document
                  for the full show.
                </p>
              </div>
              {resultsData!.classes.length > 0 ? (
                <ButtonLink href={`/shows/${id}/exports/results-pdf`}>
                  Download PDF results
                </ButtonLink>
              ) : (
                <span className="text-sm text-stone-400">
                  No official classes yet
                </span>
              )}
            </div>
          </Card>

          <Card className="border-dashed">
            <h2 className="mb-1 text-base font-semibold">
              Entry fees &amp; retainage (informational)
            </h2>
            <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
              A simple tally from official classes&apos; entry fees — not a
              payout calculation. It does not include added money, and it
              does not drive the CSV&apos;s MoneyWon field. A full payout
              engine (splits by placement, category exceptions, ties) is
              future work and needs its own tests before it can be trusted.
            </p>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 sm:justify-start">
                <dt className="text-stone-500 dark:text-stone-400">
                  Entry fees collected
                </dt>
                <dd className="font-mono">
                  {formatCents(resultsData!.totalEntryFeeCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 sm:justify-start">
                <dt className="text-stone-500 dark:text-stone-400">
                  5% retainage
                </dt>
                <dd className="font-mono">
                  {formatCents(resultsData!.retainageCents)}
                </dd>
              </div>
            </dl>
          </Card>

          <p className="text-xs text-stone-400">
            v1 covers the NRHA CSV and PDF results. The full submission
            package (per-class score sheets, tally sheet, medication fee
            summary, and collected paperwork) is a planned follow-up.
          </p>
        </>
      )}
    </div>
  );
}
