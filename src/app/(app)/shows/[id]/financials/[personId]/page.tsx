import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadPersonBill } from "@/lib/billing";
import { MiscChargeManager } from "@/components/show/misc-charge-manager";
import { PaymentManager } from "@/components/show/payment-manager";
import { Alert, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { Show } from "@/lib/types";

export const metadata = { title: "Bill — ShowRing IQ" };

export default async function PersonBillPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id, personId } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, card_surcharge_percent")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id" | "card_surcharge_percent">;

  const [canView, canEdit] = await Promise.all([
    hasOrgPermission(s.organization_id, "invoice.view"),
    hasOrgPermission(s.organization_id, "invoice.edit"),
  ]);
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this show.</Alert>
    );
  }

  const bill = await loadPersonBill(supabase, id, personId);
  if (!bill) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/financials`} className="hover:underline">
            Financials
          </Link>{" "}
          / {bill.name}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={bill.name}
            description={
              bill.billedRiderNames.length > 0
                ? `Barn bill for ${bill.billedRiderNames.join(", ")}`
                : bill.backNumbers.length > 0
                  ? `Back ${bill.backNumbers.length > 1 ? "numbers" : "number"} ${bill.backNumbers.map((n) => `#${n}`).join(", ")}`
                  : undefined
            }
          />
          <ButtonLink
            href={`/shows/${id}/financials/${personId}/statement`}
            variant="secondary"
          >
            Printable statement
          </ButtonLink>
        </div>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Entry fees</h3>
        {bill.lineItems.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No classes entered.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
                {bill.billedRiderNames.length > 0 && <th className="py-2 pr-4">Rider</th>}
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {bill.lineItems.map((li) => (
                <tr key={li.entryClassId}>
                  {bill.billedRiderNames.length > 0 && (
                    <td className="py-2 pr-4 text-stone-500 dark:text-stone-400">
                      {li.riderName}
                    </td>
                  )}
                  <td className="py-2 pr-4">
                    {li.classNumber} — {li.className}
                  </td>
                  <td className="py-2 pr-4">
                    {li.status === "scratched" && <Badge tone="warning">Scratched</Badge>}
                  </td>
                  <td className="py-2">
                    {li.status === "scratched" ? (
                      <span className="text-stone-400 line-through dark:text-stone-600">
                        {formatCents(li.feeCents)}
                      </span>
                    ) : (
                      formatCents(li.feeCents)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-right text-sm font-semibold">
          Subtotal: {formatCents(bill.entryFeeCents)}
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Misc charges</h3>
        <MiscChargeManager
          showId={id}
          personId={personId}
          charges={bill.charges}
          canEdit={canEdit}
        />
        <p className="mt-3 text-right text-sm font-semibold">
          Subtotal: {formatCents(bill.miscChargeCents)}
        </p>
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-semibold">Payments</h3>
        <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
          Payments taken by the show office — cash, checks, and cards run on
          your own terminal. Recorded here, never processed by the platform.
        </p>
        <PaymentManager
          showId={id}
          personId={personId}
          payments={bill.payments}
          canEdit={canEdit}
          cardSurchargePercent={s.card_surcharge_percent ?? 0}
        />
        <p className="mt-3 text-right text-sm font-semibold">
          Paid: {formatCents(bill.paidCents)}
          {bill.refundedCents > 0 && (
            <span className="ml-2 font-normal text-amber-600 dark:text-amber-400">
              ({formatCents(bill.refundedCents)} refunded)
            </span>
          )}
        </p>
      </Card>

      <div className="flex flex-col items-end gap-1">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Total charges: {formatCents(bill.totalCents)} · Paid:{" "}
          {formatCents(bill.paidCents)}
        </p>
        <p
          className={`text-lg font-semibold ${
            bill.balanceCents < 0
              ? "text-amber-600 dark:text-amber-400"
              : bill.balanceCents === 0
                ? "text-green-700 dark:text-green-400"
                : ""
          }`}
        >
          {bill.balanceCents < 0
            ? `Overpaid by ${formatCents(-bill.balanceCents)}`
            : bill.balanceCents === 0
              ? "Paid in full"
              : `Balance due: ${formatCents(bill.balanceCents)}`}
        </p>
      </div>
    </div>
  );
}
