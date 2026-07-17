"use client";

import { useState, useTransition } from "react";
import {
  clearRunFeeOverride,
  setRunFeeOverride,
} from "@/app/(app)/shows/[id]/financials/actions";
import { Alert, Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { centsToInput, formatCents } from "@/lib/money";
import { JUDGE_FEE_KEY, type RunFeeLine } from "@/lib/billing";

/** Run-level fees (judge / video / photo) for a person's bill. Computed
 * automatically per run; each line's price can be overridden (incl. $0 to
 * comp) while the line still shows, and reset back to the computed amount. */
export function RunFeeManager({
  showId,
  personId,
  runFees,
  showBackNumber,
  canEdit,
}: {
  showId: string;
  personId: string;
  runFees: RunFeeLine[];
  /** Prefix each line with its back number (when the person has >1 horse). */
  showBackNumber: boolean;
  canEdit: boolean;
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  if (runFees.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">No run fees.</p>
    );
  }

  const edit = async (line: RunFeeLine) => {
    const result = await confirm({
      title: `Edit ${line.label.toLowerCase()}`,
      message:
        "Computed automatically per run. Set a new total to override it — $0 comps it while the line still shows.",
      confirmLabel: "Save",
      fields: [
        {
          name: "amount",
          label: "Total ($)",
          type: "text",
          defaultValue: centsToInput(line.effectiveCents),
          required: true,
        },
        { name: "reason", label: "Reason (required)", type: "textarea", required: true },
      ],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await setRunFeeOverride(
        line.entryId,
        line.feeKey,
        result.amount,
        result.reason,
        showId,
        personId
      );
      if (res?.error) setServerError(res.error);
    });
  };

  const reset = async (line: RunFeeLine) => {
    const result = await confirm({
      title: `Reset ${line.label.toLowerCase()}`,
      message: `Reset to the computed amount (${formatCents(line.computedCents)})?`,
      confirmLabel: "Reset",
      fields: [{ name: "reason", label: "Reason (optional)", type: "textarea" }],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await clearRunFeeOverride(
        line.entryId,
        line.feeKey,
        result.reason ?? "",
        showId,
        personId
      );
      if (res?.error) setServerError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {serverError && <Alert>{serverError}</Alert>}
      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        {runFees.map((line) => {
          const overridden = line.overrideCents !== null;
          const showCount = line.feeKey !== JUDGE_FEE_KEY && line.runCount > 1;
          return (
            <li
              key={`${line.entryId}:${line.feeKey}`}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {showBackNumber && line.backNumber !== null && (
                    <span className="text-stone-500 dark:text-stone-400">
                      #{line.backNumber}{" "}
                    </span>
                  )}
                  {line.label}
                  {showCount && (
                    <span className="text-stone-500 dark:text-stone-400">
                      {" "}
                      ×{line.runCount}
                    </span>
                  )}
                </p>
                {line.detail && (
                  <p className="text-xs text-stone-500 dark:text-stone-400">{line.detail}</p>
                )}
                {overridden && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Adjusted from {formatCents(line.computedCents)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  {formatCents(line.effectiveCents)}
                </span>
                {canEdit && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => edit(line)}
                    >
                      Edit price
                    </Button>
                    {overridden && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => reset(line)}
                      >
                        Reset
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
