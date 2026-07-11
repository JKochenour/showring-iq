import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadPersonBill } from "@/lib/billing";
import { MiscChargeManager } from "@/components/show/misc-charge-manager";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
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
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id">;

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
        <PageHeader
          title={bill.name}
          description={
            bill.backNumbers.length > 0
              ? `Back ${bill.backNumbers.length > 1 ? "numbers" : "number"} ${bill.backNumbers.map((n) => `#${n}`).join(", ")}`
              : undefined
          }
        />
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Entry fees</h3>
        {bill.lineItems.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No classes entered.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {bill.lineItems.map((li) => (
                <tr key={li.entryClassId}>
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

      <div className="flex justify-end">
        <p className="text-lg font-semibold">
          Total due: {formatCents(bill.totalCents)}
        </p>
      </div>
    </div>
  );
}
