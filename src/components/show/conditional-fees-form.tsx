"use client";

import { useState, useTransition } from "react";
import { updateConditionalFees, applyCloseOutFee } from "@/app/(app)/shows/actions";
import { Alert, Button, Input, Label } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function ConditionalFeesForm({
  showId,
  lateEntryFee,
  closeOutFee,
  closeOutDeadline,
  cardSurchargePercent,
  canEdit,
}: {
  showId: string;
  lateEntryFee: string;
  closeOutFee: string;
  closeOutDeadline: string;
  cardSurchargePercent: number;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [applyResult, setApplyResult] = useState<string>();
  const confirm = useConfirmDialog();

  const [lateFee, setLateFee] = useState(lateEntryFee);
  const [closeFee, setCloseFee] = useState(closeOutFee);
  const [deadline, setDeadline] = useState(closeOutDeadline);
  const [surcharge, setSurcharge] = useState(String(cardSurchargePercent));

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateConditionalFees({
        showId,
        lateEntryFee: lateFee,
        closeOutFee: closeFee,
        closeOutDeadline: deadline,
        cardSurchargePercent: parseFloat(surcharge) || 0,
      });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  const runCloseOut = async () => {
    const result = await confirm({
      title: "Apply close-out fee",
      tone: "danger",
      message: `Charge ${closeFee ? `$${closeFee}` : "the configured fee"} to every person on this show with an outstanding balance who hasn't already been charged one. This can't be undone in bulk — charges can still be removed individually afterward.`,
      confirmLabel: "Apply to everyone owing",
    });
    if (!result) return;
    setApplyResult(undefined);
    startTransition(async () => {
      const res = await applyCloseOutFee(showId);
      if (res?.error) setError(res.error);
      else setApplyResult(`Applied to ${res.applied ?? 0} bill${res.applied === 1 ? "" : "s"}.`);
    });
  };

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Fee settings saved.</Alert>}
      {applyResult && <Alert tone="success">{applyResult}</Alert>}
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Late entry fee is offered as a checkbox when office staff create an
        entry. Close-out fee is a manual bulk action you trigger below — it
        is never applied automatically. Card surcharge is offered as a
        checkbox when recording a card payment.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="late-fee">Late entry fee ($)</Label>
          <Input
            id="late-fee"
            placeholder="0.00"
            value={lateFee}
            disabled={!canEdit}
            onChange={(e) => setLateFee(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="close-fee">Close-out fee ($)</Label>
          <Input
            id="close-fee"
            placeholder="0.00"
            value={closeFee}
            disabled={!canEdit}
            onChange={(e) => setCloseFee(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="close-deadline">Close-out deadline</Label>
          <Input
            id="close-deadline"
            type="datetime-local"
            value={deadline}
            disabled={!canEdit}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="surcharge">Card surcharge (%)</Label>
          <Input
            id="surcharge"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={surcharge}
            disabled={!canEdit}
            onChange={(e) => setSurcharge(e.target.value)}
          />
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save fee settings"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !closeFee}
            onClick={runCloseOut}
          >
            Apply close-out fee to everyone owing
          </Button>
        </div>
      )}
    </div>
  );
}
