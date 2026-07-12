import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadReconciliation } from "@/lib/billing";
import { PAYMENT_METHODS } from "@/lib/validation/billing";
import { PrintButton } from "@/components/show/print-button";
import { Alert, Card, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { Show } from "@/lib/types";

export const metadata = { title: "Reconciliation — ShowRing IQ" };

const METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, name, start_date, end_date, payouts_distributed_at")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<
    Show,
    "id" | "organization_id" | "name" | "start_date" | "end_date" | "payouts_distributed_at"
  >;

  const canView = await hasOrgPermission(s.organization_id, "invoice.view");
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this show.</Alert>
    );
  }

  const [report, { data: moneyRows }] = await Promise.all([
    loadReconciliation(supabase, id),
    supabase
      .from("results")
      .select("money_won_cents")
      .eq("show_id", id)
      .gt("money_won_cents", 0),
  ]);
  const totalPurseCents = (moneyRows ?? []).reduce(
    (sum, r) => sum + ((r.money_won_cents as number) ?? 0),
    0
  );

  const netCents = report.totalChargedCents - report.totalCollectedCents;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/financials`} className="hover:underline">
            Financials
          </Link>{" "}
          / Reconciliation
        </p>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`Reconciliation — ${s.name}`}
          description={`${s.start_date} to ${s.end_date}. Charges, collections by method, and open balances — derived live from entries, charges, and recorded payments.`}
        />
        <PrintButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-base font-semibold">Charged</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              <tr>
                <td className="py-2 pr-4">
                  Entry fees
                  <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">
                    {report.enteredRideCount} entered ride
                    {report.enteredRideCount === 1 ? "" : "s"}
                  </span>
                </td>
                <td className="py-2 text-right font-mono">
                  {formatCents(report.entryFeeCents)}
                </td>
              </tr>
              {report.chargesByCategory.map((c) => (
                <tr key={c.category}>
                  <td className="py-2 pr-4">
                    {c.category}
                    <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">
                      {c.count}×
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCents(c.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200 dark:border-stone-800">
                <td className="py-2 pr-4 font-semibold">Total charged</td>
                <td className="py-2 text-right font-mono font-semibold">
                  {formatCents(report.totalChargedCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <Card>
          <h3 className="mb-3 text-base font-semibold">Collected</h3>
          {report.paymentsByMethod.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No payments recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {report.paymentsByMethod.map((m) => (
                  <tr key={m.method}>
                    <td className="py-2 pr-4">
                      {METHOD_LABELS[m.method] ?? m.method}
                      <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">
                        {m.count} payment{m.count === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatCents(m.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 dark:border-stone-800">
                  <td className="py-2 pr-4 font-semibold">Total collected</td>
                  <td className="py-2 text-right font-mono font-semibold">
                    {formatCents(report.totalCollectedCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Open balances</h3>
        {report.openBalances.length === 0 ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            Every bill is settled — no outstanding or overpaid balances.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Back #</th>
                  <th className="py-2 pr-4 text-right">Charged</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {report.openBalances.map((r) => (
                  <tr key={r.personId}>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/shows/${id}/financials/${r.personId}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {r.backNumbers.map((n) => `#${n}`).join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {formatCents(r.totalCents)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {formatCents(r.paidCents)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono font-semibold ${
                        r.balanceCents < 0
                          ? "text-amber-600 dark:text-amber-400"
                          : ""
                      }`}
                    >
                      {formatCents(r.balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 text-right text-sm">
              <p>
                Outstanding (owed to show):{" "}
                <span className="font-mono font-semibold">
                  {formatCents(report.outstandingCents)}
                </span>
              </p>
              {report.overpaidCents > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  Overpaid (owed back):{" "}
                  <span className="font-mono font-semibold">
                    {formatCents(report.overpaidCents)}
                  </span>
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Check</h3>
        <table className="w-full max-w-md text-sm">
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            <tr>
              <td className="py-2 pr-4">Total charged</td>
              <td className="py-2 text-right font-mono">
                {formatCents(report.totalChargedCents)}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">− Total collected</td>
              <td className="py-2 text-right font-mono">
                {formatCents(report.totalCollectedCents)}
              </td>
            </tr>
            <tr className="border-t border-stone-200 dark:border-stone-800">
              <td className="py-2 pr-4 font-semibold">= Net open balance</td>
              <td
                className={`py-2 text-right font-mono font-semibold ${
                  netCents === 0 ? "text-green-700 dark:text-green-400" : ""
                }`}
              >
                {formatCents(netCents)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Net open balance always equals outstanding minus overpaid (
          {formatCents(report.outstandingCents)} − {formatCents(report.overpaidCents)}
          ) — if it doesn&apos;t, a bill changed while this page was loading;
          refresh.
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Purse (money going out)</h3>
        <div className="space-y-1 text-sm">
          <p>
            Total money won across all classes:{" "}
            <span className="font-mono font-semibold">
              {formatCents(totalPurseCents)}
            </span>
          </p>
          <p className="text-stone-500 dark:text-stone-400">
            {s.payouts_distributed_at
              ? `Payouts marked distributed on ${new Date(
                  s.payouts_distributed_at
                ).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}.`
              : "Payouts not yet marked distributed — see the Financials page for the P(5) deadline."}
          </p>
        </div>
      </Card>
    </div>
  );
}
