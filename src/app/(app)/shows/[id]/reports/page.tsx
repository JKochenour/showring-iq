import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { Card, PageHeader } from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export const metadata = { title: "Reports — ShowRing IQ" };

export default async function ReportsPage({
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

  const [{ data: classes }, canExport, canViewFinancials] = await Promise.all([
    supabase
      .from("classes")
      .select("id, class_number, name, status")
      .eq("show_id", id)
      .not("status", "in", "(draft,cancelled)")
      .order("display_order"),
    hasOrgPermission(show.organization_id, "result.export"),
    hasOrgPermission(show.organization_id, "invoice.view"),
  ]);

  const classRows = (classes as Pick<ShowClass, "id" | "class_number" | "name" | "status">[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Every printable document for this show in one place — the full day pack. Each link opens a print-ready page."
      />

      <Card>
        <h3 className="mb-3 text-base font-semibold">Show-wide</h3>
        <ul className="space-y-2 text-sm">
          {canExport && (
            <>
              <li>
                <Link
                  href={`/shows/${id}/exports/results-pdf`}
                  className="text-brand-700 hover:underline dark:text-brand-500"
                >
                  PDF results (all official classes)
                </Link>
              </li>
              <li>
                <Link
                  href={`/shows/${id}/exports`}
                  className="text-brand-700 hover:underline dark:text-brand-500"
                >
                  NRHA CSV / submission package
                </Link>
              </li>
            </>
          )}
          <li>
            <Link
              href={`/shows/${id}/schedule`}
              className="text-brand-700 hover:underline dark:text-brand-500"
            >
              Schedule (estimated start times)
            </Link>
          </li>
          {canViewFinancials && (
            <li>
              <Link
                href={`/shows/${id}/financials/reconciliation`}
                className="text-brand-700 hover:underline dark:text-brand-500"
              >
                End-of-show financial reconciliation
              </Link>
            </li>
          )}
        </ul>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Per class ({classRows.length})</h3>
        {classRows.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No classes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 font-medium">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {classRows.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 font-mono">{c.class_number}</td>
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/shows/${id}/draws/${c.id}/gate-sheet`}
                          target="_blank"
                          className="text-brand-700 hover:underline dark:text-brand-500"
                        >
                          Gate sheet
                        </Link>
                        <Link
                          href={`/shows/${id}/scoring/${c.id}/score-sheet`}
                          target="_blank"
                          className="text-brand-700 hover:underline dark:text-brand-500"
                        >
                          Judge/scribe score sheet
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
