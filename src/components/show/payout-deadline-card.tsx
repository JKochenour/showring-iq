"use client";

import { useState, useTransition } from "react";
import { markPayoutsDistributed } from "@/app/(app)/shows/[id]/financials/actions";
import { Alert, Button, Card } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { formatCents } from "@/lib/money";

/** Payout distribution deadline (NRHA Show Rules P(5)): purse money must
 * reach the recorded rider/agent/owner within 30 days of event completion.
 * Soft tracking — a reminder plus a mark-distributed toggle, nothing
 * blocking. */
export function PayoutDeadlineCard({
  showId,
  deadlineLabel,
  daysLeft,
  distributedAt,
  totalMoneyWonCents,
  canMark,
}: {
  showId: string;
  deadlineLabel: string;
  daysLeft: number;
  distributedAt: string | null;
  totalMoneyWonCents: number;
  canMark: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const run = (distributed: boolean) => {
    setError(undefined);
    startTransition(async () => {
      const result = await markPayoutsDistributed(showId, distributed);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold">Payout distribution</h2>
      <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
        NRHA Show Rules P(5): payouts must be made within 30 days of event
        completion. Results and related documents are due to the NRHA office
        within 10 business days (P(4)) — fines apply after that.
      </p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="space-y-1 text-sm">
        {totalMoneyWonCents > 0 && (
          <p>
            Total money won across all classes:{" "}
            <span className="font-mono font-medium">
              {formatCents(totalMoneyWonCents)}
            </span>
          </p>
        )}
        {distributedAt ? (
          <p className="text-green-700 dark:text-green-400">
            ✓ Marked distributed on{" "}
            {new Date(distributedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        ) : (
          <p
            className={
              daysLeft < 0
                ? "font-medium text-red-600 dark:text-red-400"
                : daysLeft <= 7
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : ""
            }
          >
            {daysLeft < 0
              ? `Distribution deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago (${deadlineLabel}).`
              : `Distribution due by ${deadlineLabel} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`}
          </p>
        )}
      </div>
      {canMark && (
        <div className="mt-3">
          {distributedAt ? (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => run(false)}
            >
              {isPending ? "Working…" : "Unmark distributed"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={async () => {
                const result = await confirm({
                  title: "Mark payouts distributed",
                  message:
                    "Confirm all purse money has been paid out to the recorded riders/agents/owners. This records the date in the audit log.",
                  confirmLabel: "Mark distributed",
                });
                if (result) run(true);
              }}
            >
              {isPending ? "Working…" : "Mark payouts distributed"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
