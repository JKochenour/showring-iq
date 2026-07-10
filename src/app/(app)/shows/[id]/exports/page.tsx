import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadNrhaExportData } from "@/lib/load-nrha-export";
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
  const data = canExport
    ? await loadNrhaExportData(supabase, id)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exports"
        description="NRHA ReinerSuite CSV — the first association submission target. A class must be marked official (Scoring tab) to be included."
      />

      {!canExport ? (
        <Alert tone="info">
          You don&apos;t have the result.export permission in this organization.
        </Alert>
      ) : (
        <>
          <Card
            className={
              data!.ready
                ? "border-emerald-300 dark:border-emerald-800"
                : "border-amber-300 dark:border-amber-800"
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  NRHA Submission:{" "}
                  <span
                    className={
                      data!.ready
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {data!.ready ? "Ready" : `${data!.readiness.length} issue${data!.readiness.length === 1 ? "" : "s"}`}
                  </span>
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {data!.includedClassCount} class
                  {data!.includedClassCount === 1 ? "" : "es"} included ·{" "}
                  {data!.rows.length} row{data!.rows.length === 1 ? "" : "s"}
                </p>
              </div>
              {data!.ready && (
                <ButtonLink href={`/shows/${id}/exports/nrha-csv`}>
                  Download NRHA CSV
                </ButtonLink>
              )}
            </div>
            {data!.readiness.length > 0 ? (
              <IssueList issues={data!.readiness} />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Every check passed.
              </p>
            )}
          </Card>

          <p className="text-xs text-zinc-400">
            v1 exports the ReinerSuite CSV only. The full submission package
            (PDF results, score sheets, tally sheet, retainage/medication
            summaries, and collected paperwork) is a planned follow-up.
          </p>
        </>
      )}
    </div>
  );
}
