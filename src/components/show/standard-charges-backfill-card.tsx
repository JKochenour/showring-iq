"use client";

import { useState, useTransition } from "react";
import { applyStandardChargesToExisting } from "@/app/(app)/shows/actions";
import { Alert, Button, Card } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { formatCents } from "@/lib/money";

/** Standard charges (office / stall / drug) are snapshotted onto a horse
 * when it first receives a back number, so configuring or correcting them
 * after entries are taken misses every horse already entered — and the
 * office only finds out when the bills come up short.
 *
 * This offers the backfill where the money work happens. It is never
 * automatic, and it skips anything already billed, so running it twice
 * costs nothing. */
export function StandardChargesBackfillCard({
  showId,
  charges,
  canApply,
}: {
  showId: string;
  /** The show's configured once-per-horse-per-weekend charges. */
  charges: { label: string; amountCents: number }[];
  canApply: boolean;
}) {
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const total = charges.reduce((sum, c) => sum + c.amountCents, 0);

  const run = async () => {
    const ok = await confirm({
      title: "Apply standard charges to horses already entered",
      message: `Charge ${charges
        .map((c) => c.label)
        .join(", ")} to every horse that already has a back number and hasn't been billed for them yet. Charges already on a bill are left alone. Individual charges can still be edited or removed afterward.`,
      confirmLabel: "Apply to entered horses",
    });
    if (!ok) return;
    setError(undefined);
    setResult(undefined);
    startTransition(async () => {
      const res = await applyStandardChargesToExisting(showId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      const inserted = res.inserted ?? 0;
      const skipped = res.skipped ?? 0;
      const horses = res.horses ?? 0;
      setResult(
        inserted === 0
          ? `Nothing to add — all ${horses} entered ${horses === 1 ? "horse is" : "horses are"} already billed for these charges.`
          : `Added ${inserted} charge${inserted === 1 ? "" : "s"} across ${horses} entered ${horses === 1 ? "horse" : "horses"}${skipped > 0 ? `, skipping ${skipped} already billed` : ""}.`
      );
    });
  };

  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold">Standard charges</h2>
      <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
        These are charged once per horse for the whole weekend, at the moment
        the horse first gets a back number. If you set them up or changed them
        after entries were taken, horses already entered were missed — apply
        them here.
      </p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {result && (
        <div className="mb-3">
          <Alert tone="success">{result}</Alert>
        </div>
      )}
      <ul className="space-y-1 text-sm">
        {charges.map((c) => (
          <li key={c.label} className="flex justify-between gap-4">
            <span>{c.label}</span>
            <span className="font-mono">{formatCents(c.amountCents)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 border-t border-stone-200 pt-1 font-medium dark:border-stone-800">
          <span>Per horse</span>
          <span className="font-mono">{formatCents(total)}</span>
        </li>
      </ul>
      {canApply && (
        <div className="mt-3">
          <Button variant="secondary" disabled={isPending} onClick={run}>
            {isPending ? "Applying…" : "Apply to horses already entered"}
          </Button>
        </div>
      )}
    </Card>
  );
}
