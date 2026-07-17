import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadWeekendPersonBill } from "@/lib/billing";
import { Alert, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Weekend bill — ShowRing IQ" };

export default async function WeekendPersonBillPage({
  params,
}: {
  params: Promise<{ id: string; weekendId: string; personId: string }>;
}) {
  const { id, weekendId, personId } = await params;
  const { supabase } = await requireUser();

  const { data: weekend } = await supabase
    .from("show_weekends")
    .select("id, name, organization_id, shows:shows(id, name, start_date)")
    .eq("id", weekendId)
    .maybeSingle();
  if (!weekend || weekend.organization_id !== id) notFound();

  const canView = await hasOrgPermission(id, "invoice.view");
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this weekend.</Alert>
    );
  }

  const bill = await loadWeekendPersonBill(supabase, weekendId, personId);
  if (!bill) notFound();

  const slates = (
    (weekend.shows as { id: string; name: string; start_date: string }[]) ?? []
  )
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link
            href={`/organizations/${id}/weekends/${weekendId}/financials`}
            className="hover:underline"
          >
            Consolidated billing
          </Link>{" "}
          / {bill.name}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={bill.name}
            description={
              bill.backNumbers.length > 0
                ? `Back ${bill.backNumbers.length > 1 ? "numbers" : "number"} ${bill.backNumbers.map((n) => `#${n}`).join(", ")} · whole weekend`
                : "Whole weekend"
            }
          />
          <ButtonLink
            href={`/organizations/${id}/weekends/${weekendId}/financials/${personId}/statement`}
            variant="secondary"
          >
            Printable statement
          </ButtonLink>
        </div>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Entry fees (all slates)</h3>
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
        <h3 className="mb-3 text-base font-semibold">Run fees (all slates)</h3>
        {bill.runFees.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No run fees.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {bill.runFees.map((line) => (
                <tr key={`${line.entryId}:${line.feeKey}`}>
                  <td className="py-2 pr-4">
                    {line.backNumber !== null && (
                      <span className="text-stone-500 dark:text-stone-400">
                        #{line.backNumber}{" "}
                      </span>
                    )}
                    {line.label}
                    {line.feeKey !== "judge" && line.runCount > 1 && ` ×${line.runCount}`}
                    {line.detail && (
                      <span className="block text-xs text-stone-500 dark:text-stone-400">
                        {line.detail}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">{formatCents(line.effectiveCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-right text-sm font-semibold">
          Subtotal: {formatCents(bill.runFeeCents)}
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Misc charges (all slates)</h3>
        {bill.charges.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No misc charges.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {bill.charges.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-4">{c.description}</td>
                  <td className="py-2 text-right">{formatCents(c.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-right text-sm font-semibold">
          Subtotal: {formatCents(bill.miscChargeCents)}
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">Payments (all slates)</h3>
        {bill.payments.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No payments recorded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 capitalize">
                    {p.isRefund ? "Refund" : p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </td>
                  <td className="py-2 text-right">
                    {p.isRefund ? "−" : ""}
                    {formatCents(p.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-right text-sm font-semibold">
          Paid: {formatCents(bill.paidCents)}
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

      <Card>
        <h3 className="mb-1 text-sm font-semibold">Take a payment or edit charges</h3>
        <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
          This weekend view is a read-only total. Record payments, refunds, or
          charge edits on the person&apos;s bill for a slate — they roll up here
          automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          {slates.map((s) => (
            <Link
              key={s.id}
              href={`/shows/${s.id}/financials/${personId}`}
              className="rounded-md border border-stone-200 px-3 py-1.5 text-sm hover:border-brand-600 dark:border-stone-800"
            >
              {s.name} bill →
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
