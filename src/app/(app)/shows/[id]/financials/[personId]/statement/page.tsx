import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadPersonBill } from "@/lib/billing";
import { PAYMENT_METHODS } from "@/lib/validation/billing";
import { PrintButton } from "@/components/show/print-button";
import { Alert } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { Show } from "@/lib/types";

export const metadata = { title: "Statement — ShowRing IQ" };

const METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

export default async function PersonStatementPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id, personId } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, name, start_date, end_date, venue_name, city, state, organization:organizations(name)")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<
    Show,
    "id" | "organization_id" | "name" | "start_date" | "end_date" | "venue_name" | "city" | "state"
  >;
  const orgName =
    (show.organization as unknown as { name: string } | null)?.name ?? "";

  const canView = await hasOrgPermission(s.organization_id, "invoice.view");
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this show.</Alert>
    );
  }

  const bill = await loadPersonBill(supabase, id, personId);
  if (!bill) notFound();

  const location = [s.venue_name, s.city, s.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/financials`} className="hover:underline">
            Financials
          </Link>{" "}
          /{" "}
          <Link
            href={`/shows/${id}/financials/${personId}`}
            className="hover:underline"
          >
            {bill.name}
          </Link>{" "}
          / Statement
        </p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-8 text-stone-900 dark:border-stone-800 print:border-0 print:p-0">
        <div className="mb-6 border-b border-stone-300 pb-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {orgName}
          </p>
          <h1 className="text-xl font-bold">{s.name}</h1>
          <p className="text-sm text-stone-600">
            {s.start_date} to {s.end_date}
            {location && ` · ${location}`}
          </p>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-lg font-semibold">Statement — {bill.name}</p>
            {bill.backNumbers.length > 0 && (
              <p className="font-mono text-sm">
                Back {bill.backNumbers.length > 1 ? "numbers" : "number"}{" "}
                {bill.backNumbers.map((n) => `#${n}`).join(", ")}
              </p>
            )}
          </div>
        </div>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Entry fees
        </h2>
        {bill.lineItems.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500">No classes entered.</p>
        ) : (
          <table className="mb-4 w-full text-sm">
            <tbody className="divide-y divide-stone-200">
              {bill.lineItems.map((li) => (
                <tr key={li.entryClassId}>
                  <td className="py-1.5 pr-4">
                    {li.classNumber} — {li.className}
                    {li.status === "scratched" && (
                      <span className="ml-2 text-xs text-stone-500">(scratched)</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {li.status === "scratched" ? (
                      <span className="text-stone-400 line-through">
                        {formatCents(li.feeCents)}
                      </span>
                    ) : (
                      formatCents(li.feeCents)
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-stone-300">
                <td className="py-1.5 pr-4 font-semibold">Entry fees subtotal</td>
                <td className="py-1.5 text-right font-mono font-semibold">
                  {formatCents(bill.entryFeeCents)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {bill.charges.length > 0 && (
          <>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Charges
            </h2>
            <table className="mb-4 w-full text-sm">
              <tbody className="divide-y divide-stone-200">
                {bill.charges.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-4">
                      {c.description}
                      {c.category !== c.description && (
                        <span className="ml-2 text-xs text-stone-500">
                          {c.category}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatCents(c.amountCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-stone-300">
                  <td className="py-1.5 pr-4 font-semibold">Charges subtotal</td>
                  <td className="py-1.5 text-right font-mono font-semibold">
                    {formatCents(bill.miscChargeCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Payments received
        </h2>
        {bill.payments.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500">No payments recorded.</p>
        ) : (
          <table className="mb-4 w-full text-sm">
            <tbody className="divide-y divide-stone-200">
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 pr-4">
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    — {METHOD_LABELS[p.method] ?? p.method}
                    {p.reference && (
                      <span className="ml-2 text-xs text-stone-500">
                        {p.reference}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {formatCents(p.amountCents)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-stone-300">
                <td className="py-1.5 pr-4 font-semibold">Payments subtotal</td>
                <td className="py-1.5 text-right font-mono font-semibold">
                  {formatCents(bill.paidCents)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="mt-6 border-t-2 border-stone-900 pt-3 text-right">
          <p className="text-sm">
            Total charges: <span className="font-mono">{formatCents(bill.totalCents)}</span>
            {" · "}
            Paid: <span className="font-mono">{formatCents(bill.paidCents)}</span>
          </p>
          <p className="mt-1 text-lg font-bold">
            {bill.balanceCents < 0
              ? `Overpaid by ${formatCents(-bill.balanceCents)}`
              : bill.balanceCents === 0
                ? "Paid in full"
                : `Balance due: ${formatCents(bill.balanceCents)}`}
          </p>
        </div>

        <p className="mt-8 text-xs text-stone-500">
          Statement generated by ShowRing IQ from the show&apos;s live billing
          records. Payments listed were received by show management; card
          payments were processed on show management&apos;s own terminal.
        </p>
      </div>
    </div>
  );
}
