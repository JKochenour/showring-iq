import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadPayeeReport, FORM_1099_THRESHOLD_CENTS } from "@/lib/tax-report";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Payee report — ShowRing IQ" };

export default async function PayeeReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const { supabase } = await requireUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const canView = await hasOrgPermission(id, "invoice.view");
  if (!canView) {
    return <Alert>You don&apos;t have permission to view the payee report.</Alert>;
  }

  const currentYear = new Date().getUTCFullYear();
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;
  const yearOptions = new Set([currentYear, currentYear - 1, currentYear - 2, year]);

  const rows = await loadPayeeReport(supabase, id, year);
  const overThreshold = rows.filter((r) => r.moneyWonCents >= FORM_1099_THRESHOLD_CENTS);
  const missingW9 = overThreshold.filter((r) => !r.hasVerifiedW9);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payee report"
        description="Year-end purse-money totals per payee (owner of record, falling back to rider), across every show this year — a prep aid for 1099-NEC, not a filer."
      />

      <Alert tone="info">
        Validation assistance only. Confirm payee identity, amounts, and W-9
        status independently before filing. Money totals here reflect
        results.money_won_cents, not actual disbursed payments — cross-check
        against each show&apos;s Financials → Payout distribution before
        relying on this for filing.
      </Alert>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            Year
          </label>
          <select
            name="year"
            defaultValue={String(year)}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            {[...yearOptions]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
        >
          Update
        </button>
      </form>

      {missingW9.length > 0 && (
        <Alert tone="error">
          {missingW9.length} payee{missingW9.length === 1 ? "" : "s"} earned{" "}
          {formatCents(FORM_1099_THRESHOLD_CENTS)} or more but{" "}
          {missingW9.length === 1 ? "has" : "have"} no verified W-9 on file:{" "}
          {missingW9.map((r) => r.name).join(", ")}.
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No payouts found"
          description={`No results with money won in ${year}.`}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Payee</th>
                  <th className="py-2 pr-4 font-medium">Legal name (tax)</th>
                  <th className="py-2 pr-4 font-medium">Shows</th>
                  <th className="py-2 pr-4 font-medium">Total won</th>
                  <th className="py-2 font-medium">W-9</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {rows.map((r) => (
                  <tr key={r.personId}>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/organizations/${id}/people/${r.personId}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-500"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-stone-500 dark:text-stone-400">
                      {r.taxName ?? "—"}
                    </td>
                    <td className="py-2 pr-4">{r.showCount}</td>
                    <td
                      className={`py-2 pr-4 font-mono ${
                        r.moneyWonCents >= FORM_1099_THRESHOLD_CENTS ? "font-semibold" : ""
                      }`}
                    >
                      {formatCents(r.moneyWonCents)}
                    </td>
                    <td className="py-2">
                      {r.hasVerifiedW9 ? (
                        <span className="text-green-700 dark:text-green-400">✓ on file</span>
                      ) : r.moneyWonCents >= FORM_1099_THRESHOLD_CENTS ? (
                        <span className="text-amber-600 dark:text-amber-400">missing</span>
                      ) : (
                        <span className="text-stone-400">—</span>
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
