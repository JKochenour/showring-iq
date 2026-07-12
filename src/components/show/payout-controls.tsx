"use client";

import { useState, useTransition } from "react";
import {
  approvePayouts,
  calculatePayouts,
  calculateSinglePursePayouts,
  updatePayoutSettings,
} from "@/app/(app)/shows/[id]/results/actions";
import { EXAMPLE_PAYOUT_SCHEDULE } from "@/lib/validation/payout";
import {
  buildPaybackSchedule,
  PAYBACK_SCHEDULE_LABELS,
  placesPaid,
  type PaybackScheduleId,
} from "@/lib/nrha-payback-schedules";
import { Alert, Button, Input, Label, Select } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { PayoutScheduleEntry } from "@/lib/types";

export function PayoutScheduleEditor({
  classId,
  showId,
  retainagePercent,
  schedule,
  entryCount,
  canEdit,
}: {
  classId: string;
  showId: string;
  retainagePercent: number;
  schedule: PayoutScheduleEntry[];
  entryCount: number;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [retainage, setRetainage] = useState(String(retainagePercent));
  const [rows, setRows] = useState<PayoutScheduleEntry[]>(
    schedule.length > 0 ? schedule : []
  );
  const [paybackId, setPaybackId] = useState<PaybackScheduleId>("A");
  const [paybackEntries, setPaybackEntries] = useState(String(entryCount));

  const total = rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePayoutSettings(
        {
          classId,
          retainagePercent: parseFloat(retainage) || 0,
          schedule: rows.map((r) => ({
            placing: Number(r.placing),
            percent: Number(r.percent),
          })),
        },
        showId
      );
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Payout settings saved.</Alert>}
      <div className="max-w-[160px]">
        <Label htmlFor="retainage">Retainage %</Label>
        <Input
          id="retainage"
          type="number"
          step="0.1"
          min={0}
          max={100}
          value={retainage}
          disabled={!canEdit}
          onChange={(e) => setRetainage(e.target.value)}
        />
      </div>
      <div>
        <Label>Payout schedule (% of pool by placing)</Label>
        <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">
          Pool = entry fees (shown entries) + added money, minus retainage.
          Tied placings split their combined percentage evenly. This is a
          calculator, not an approved formula — confirm the percentages
          against your fee schedule before relying on the output.
        </p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={row.placing}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], placing: Number(e.target.value) };
                  setRows(next);
                }}
              />
              <span className="text-sm text-stone-500">place →</span>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className="w-24"
                value={row.percent}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], percent: Number(e.target.value) };
                  setRows(next);
                }}
              />
              <span className="text-sm text-stone-500">%</span>
              {canEdit && (
                <Button
                  variant="secondary"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setRows([
                  ...rows,
                  { placing: rows.length + 1, percent: 0 },
                ])
              }
            >
              Add row
            </Button>
            {rows.length === 0 && (
              <Button
                variant="secondary"
                onClick={() => setRows(EXAMPLE_PAYOUT_SCHEDULE)}
              >
                Load example schedule
              </Button>
            )}
          </div>
        )}
        {canEdit && (
          <div className="mt-3 rounded-md border border-stone-200 p-3 dark:border-stone-800">
            <p className="text-sm font-medium">Fill from NRHA Payback Schedule</p>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Replaces the rows above with the published NRHA percentages for
              the entry count. Verify against the current handbook before
              relying on it.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="payback-schedule">Schedule</Label>
                <Select
                  id="payback-schedule"
                  value={paybackId}
                  onChange={(e) => setPaybackId(e.target.value as PaybackScheduleId)}
                >
                  {(Object.keys(PAYBACK_SCHEDULE_LABELS) as PaybackScheduleId[]).map(
                    (id) => (
                      <option key={id} value={id}>
                        {PAYBACK_SCHEDULE_LABELS[id]}
                      </option>
                    )
                  )}
                </Select>
              </div>
              <div className="max-w-[120px]">
                <Label htmlFor="payback-entries">Horses entered</Label>
                <Input
                  id="payback-entries"
                  type="number"
                  min={1}
                  value={paybackEntries}
                  onChange={(e) => setPaybackEntries(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={(parseInt(paybackEntries, 10) || 0) < 1}
                onClick={() =>
                  setRows(
                    buildPaybackSchedule(paybackId, parseInt(paybackEntries, 10) || 0)
                  )
                }
              >
                Fill{" "}
                {(parseInt(paybackEntries, 10) || 0) >= 1
                  ? `(pays ${placesPaid(paybackId, parseInt(paybackEntries, 10) || 0)} places)`
                  : ""}
              </Button>
            </div>
          </div>
        )}
        <p
          className={`mt-2 text-xs ${total > 100 ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400"}`}
        >
          Total: {total}% {total > 100 && "— exceeds 100%, check your numbers"}
        </p>
      </div>
      {canEdit && (
        <Button disabled={isPending} onClick={save}>
          {isPending ? "Saving…" : "Save payout settings"}
        </Button>
      )}
    </div>
  );
}

export function PayoutActions({
  classId,
  showId,
  canCalculate,
  canApprove,
  isSinglePurse = false,
}: {
  classId: string;
  showId: string;
  canCalculate: boolean;
  canApprove: boolean;
  isSinglePurse?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div>
      {error && (
        <div className="mb-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canCalculate && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              run(() =>
                isSinglePurse
                  ? calculateSinglePursePayouts(classId, showId)
                  : calculatePayouts(classId, showId)
              )
            }
          >
            {isPending ? "Calculating…" : "Calculate payouts"}
          </Button>
        )}
        {canApprove && (
          <Button
            disabled={isPending}
            onClick={async () => {
              const result = await confirm({
                title: "Approve payouts",
                message:
                  "Approve these payout amounts? This records the approval in the audit log.",
                confirmLabel: "Approve",
              });
              if (result) run(() => approvePayouts(classId, showId));
            }}
          >
            {isPending ? "Working…" : "Approve payouts"}
          </Button>
        )}
      </div>
    </div>
  );
}
