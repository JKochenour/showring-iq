import { formatCents } from "@/lib/money";
import type { PersonStatement, StatementRow } from "@/lib/billing";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  other: "Other",
};

function RowsTable({ rows, showExhibitor }: { rows: StatementRow[]; showExhibitor: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-300 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <th className="w-10 py-1.5 pr-2 text-right">Qty</th>
          <th className="py-1.5 pr-4">Description</th>
          {showExhibitor && <th className="py-1.5 pr-4">Exhibitor</th>}
          <th className="py-1.5 text-right">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-200">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="py-1.5 pr-2 text-right font-mono text-stone-500">{r.qty}</td>
            <td className={`py-1.5 pr-4 ${r.struck ? "text-stone-400 line-through" : ""}`}>
              {r.description}
            </td>
            {showExhibitor && (
              <td className="py-1.5 pr-4 text-stone-600">{r.exhibitor ?? ""}</td>
            )}
            <td
              className={`py-1.5 text-right font-mono ${r.struck ? "text-stone-400 line-through" : ""}`}
            >
              {formatCents(r.amountCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** EPRHA-style printable statement: fees itemized under each Back # (horse),
 * split by slate, with a Total Fees / Total amount due footer. */
export function StatementDocument({
  statement,
  orgName,
  title,
  subtitle,
  contact,
}: {
  statement: PersonStatement;
  orgName: string;
  title: string;
  subtitle: string;
  contact?: { name: string | null; email: string | null; phone: string | null } | null;
}) {
  const showExhibitor = statement.billedRiderNames.length > 0;
  const multiSlate =
    new Set(statement.horses.flatMap((h) => h.slates.map((s) => s.showId))).size > 1;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 text-stone-900 dark:border-stone-800 print:border-0 print:p-0">
      <div className="mb-6 flex items-start justify-between border-b border-stone-300 pb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {orgName}
          </p>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-stone-600">{subtitle}</p>
          <p className="mt-3 text-lg font-semibold">{statement.name}</p>
          {statement.billedRiderNames.length > 0 && (
            <p className="text-sm text-stone-600">
              Barn bill for: {statement.billedRiderNames.join(", ")}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase tracking-wide">Statement</p>
          {contact && (contact.name || contact.email || contact.phone) && (
            <div className="mt-2 text-xs text-stone-600">
              <p className="font-semibold">Show contact</p>
              {contact.name && <p>{contact.name}</p>}
              {contact.phone && <p>{contact.phone}</p>}
              {contact.email && <p>{contact.email}</p>}
            </div>
          )}
        </div>
      </div>

      {statement.horses.map((horse, hi) => (
        <div key={hi} className="mb-5">
          <p className="mb-1 border-b border-stone-200 pb-1 text-sm font-bold">
            Back #{horse.backNumber ?? "—"}
            {horse.horseName && <span className="ml-2 font-normal italic">{horse.horseName}</span>}
          </p>
          {horse.slates.map((slate, si) => (
            <div key={si} className="mb-3">
              {multiSlate && (
                <p className="mb-1 text-xs font-semibold text-stone-500">{slate.showLabel}</p>
              )}
              <RowsTable rows={slate.rows} showExhibitor={showExhibitor} />
              <p className="mt-1 text-right text-sm font-semibold">
                Subtotal: {formatCents(slate.subtotalCents)}
              </p>
            </div>
          ))}
        </div>
      ))}

      {statement.otherCharges.length > 0 && (
        <div className="mb-5">
          <p className="mb-1 border-b border-stone-200 pb-1 text-sm font-bold">Other charges</p>
          <RowsTable rows={statement.otherCharges} showExhibitor={false} />
          <p className="mt-1 text-right text-sm font-semibold">
            Subtotal: {formatCents(statement.otherChargesCents)}
          </p>
        </div>
      )}

      <div className="mt-4 border-t-2 border-stone-900 pt-2 text-right">
        <p className="text-sm">
          Total Fees: <span className="font-mono font-bold">{formatCents(statement.totalFeesCents)}</span>
        </p>
      </div>

      {statement.payments.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Payments received
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-200">
              {statement.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 pr-4">
                    {p.isRefund && <span className="text-stone-500">Refund — </span>}
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    — {METHOD_LABELS[p.method] ?? p.method}
                    {p.reference && <span className="ml-2 text-xs text-stone-500">{p.reference}</span>}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {p.isRefund ? "−" : ""}
                    {formatCents(p.amountCents)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-stone-300">
                <td className="py-1.5 pr-4 font-semibold">Payments subtotal</td>
                <td className="py-1.5 text-right font-mono font-semibold">
                  {formatCents(statement.paidCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 border-t-2 border-stone-900 pt-3 text-right">
        <p className="text-sm">
          Total Fees: <span className="font-mono">{formatCents(statement.totalFeesCents)}</span>
          {" · "}Paid: <span className="font-mono">{formatCents(statement.paidCents)}</span>
        </p>
        <p className="mt-1 text-lg font-bold">
          {statement.balanceCents < 0
            ? `Overpaid by ${formatCents(-statement.balanceCents)}`
            : statement.balanceCents === 0
              ? "Paid in full"
              : `Total amount due: ${formatCents(statement.balanceCents)}`}
        </p>
      </div>
    </div>
  );
}
