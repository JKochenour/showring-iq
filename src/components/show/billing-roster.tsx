"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { BillingRosterRow } from "@/lib/billing";

export function BillingRoster({
  showId,
  rows,
}: {
  showId: string;
  rows: BillingRosterRow[];
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.backNumbers.some((n) => String(n).includes(q))
      )
    : rows;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by name or back number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {rows.length === 0
            ? "No entries yet — bills appear once people are entered."
            : "No match."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Back #</th>
                <th className="py-2 pr-4">Entry fees</th>
                <th className="py-2 pr-4">Misc charges</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Paid</th>
                <th className="py-2">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filtered.map((r) => (
                <tr key={r.personId}>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/shows/${showId}/financials/${r.personId}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      {r.name}
                    </Link>
                    {r.billedRiderNames.length > 0 && (
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Barn bill: {r.billedRiderNames.join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono">
                    {r.backNumbers.map((n) => `#${n}`).join(", ") || "—"}
                  </td>
                  <td className="py-2 pr-4">{formatCents(r.entryFeeCents)}</td>
                  <td className="py-2 pr-4">{formatCents(r.miscChargeCents)}</td>
                  <td className="py-2 pr-4">{formatCents(r.totalCents)}</td>
                  <td className="py-2 pr-4">{formatCents(r.paidCents)}</td>
                  <td
                    className={`py-2 font-semibold ${
                      r.balanceCents < 0
                        ? "text-amber-600 dark:text-amber-400"
                        : r.balanceCents === 0
                          ? "text-green-700 dark:text-green-400"
                          : ""
                    }`}
                  >
                    {formatCents(r.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
