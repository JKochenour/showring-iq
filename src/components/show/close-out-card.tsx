"use client";

import { useState, useTransition } from "react";
import { applyCloseOutFee } from "@/app/(app)/shows/actions";
import { Alert, Button, Card } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { formatCents } from "@/lib/money";

/** Close-out deadline reminder (EPRHA: bills settled before noon Sunday
 * or a $50 fee applies). Rendered only when the show has a close-out fee
 * configured. The fee is never applied automatically — this surfaces the
 * deadline where staff actually work during the show and offers the same
 * bulk apply as the settings page. */
export function CloseOutCard({
  showId,
  feeCents,
  deadlineLabel,
  deadlinePassed,
  openBalanceCount,
  canApply,
}: {
  showId: string;
  feeCents: number;
  /** Formatted deadline, or null when no deadline is configured. */
  deadlineLabel: string | null;
  deadlinePassed: boolean;
  /** People on the roster with a balance due right now. */
  openBalanceCount: number;
  canApply: boolean;
}) {
  const [error, setError] = useState<string>();
  const [applied, setApplied] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const run = async () => {
    const result = await confirm({
      title: "Apply close-out fee",
      tone: "danger",
      message: `Charge ${formatCents(feeCents)} to every person with an outstanding balance who hasn't already been charged one. This can't be undone in bulk — charges can still be removed individually afterward.`,
      confirmLabel: "Apply to everyone owing",
    });
    if (!result) return;
    setError(undefined);
    setApplied(undefined);
    startTransition(async () => {
      const res = await applyCloseOutFee(showId);
      if (res?.error) setError(res.error);
      else
        setApplied(
          `Applied to ${res.applied ?? 0} bill${res.applied === 1 ? "" : "s"}.`
        );
    });
  };

  const urgent = deadlinePassed && openBalanceCount > 0;

  return (
    <Card className={urgent ? "border-amber-300 dark:border-amber-800" : undefined}>
      <h2 className="mb-1 text-base font-semibold">Close-out</h2>
      <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
        Bills not settled by the deadline get the {formatCents(feeCents)}{" "}
        close-out fee. It is never applied automatically — apply it below
        once the deadline passes.
      </p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {applied && (
        <div className="mb-3">
          <Alert tone="success">{applied}</Alert>
        </div>
      )}
      <div className="space-y-1 text-sm">
        <p
          className={
            urgent ? "font-medium text-amber-600 dark:text-amber-400" : ""
          }
        >
          {deadlineLabel
            ? deadlinePassed
              ? `Close-out deadline passed (${deadlineLabel}).`
              : `Bills close out by ${deadlineLabel}.`
            : "No close-out deadline set — configure one in show settings."}
        </p>
        <p>
          {openBalanceCount === 0
            ? "Every bill is settled."
            : `${openBalanceCount} ${openBalanceCount === 1 ? "person owes" : "people owe"} a balance right now.`}
        </p>
      </div>
      {canApply && deadlinePassed && openBalanceCount > 0 && (
        <div className="mt-3">
          <Button variant="secondary" disabled={isPending} onClick={run}>
            {isPending ? "Applying…" : "Apply close-out fee to everyone owing"}
          </Button>
        </div>
      )}
    </Card>
  );
}
