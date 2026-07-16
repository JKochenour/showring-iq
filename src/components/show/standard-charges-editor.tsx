"use client";

import { useState, useTransition } from "react";
import { updateStandardCharges } from "@/app/(app)/shows/actions";
import {
  STANDARD_CHARGE_STARTER_SET,
  type StandardChargeRow,
} from "@/lib/validation/show";
import { Alert, Button, Input } from "@/components/ui";

export function StandardChargesEditor({
  showId,
  charges,
  canEdit,
}: {
  showId: string;
  charges: StandardChargeRow[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<StandardChargeRow[]>(charges);

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateStandardCharges({ showId, charges: rows });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Standard charges saved.</Alert>}
      <p className="text-sm text-stone-500 dark:text-stone-400">
        These land on a person&apos;s bill automatically — no manual entry
        needed. A normal charge (office, stall, drug) applies once per horse
        the first time it gets a back number. Check <strong>Per run</strong>
        for a video or photo fee: it&apos;s charged once per run (a set of
        classes that run concurrent), so a horse making two runs pays it
        twice. Check <strong>Youth $0</strong> (e.g. the office fee) to zero
        it for a youth-only horse — the line still shows as
        &ldquo;… - youth entry only&rdquo; so you keep the count. Leave the
        list empty if this show doesn&apos;t use standard charges. Any amount
        can be edited or comped on a specific bill.
      </p>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="e.g. Stall"
                className="max-w-xs"
                value={row.label}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], label: e.target.value };
                  setRows(next);
                }}
              />
              <span className="text-sm text-stone-500">$</span>
              <Input
                placeholder="0.00"
                className="w-28"
                value={row.amount}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], amount: e.target.value };
                  setRows(next);
                }}
              />
              <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                  checked={row.perRun}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...next[i], perRun: e.target.checked };
                    setRows(next);
                  }}
                />
                Per run
              </label>
              <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                  checked={row.youthExempt}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...next[i], youthExempt: e.target.checked };
                    setRows(next);
                  }}
                />
                Youth $0
              </label>
              {canEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setRows([...rows, { label: "", amount: "", perRun: false, youthExempt: false }])
            }
          >
            Add row
          </Button>
          {rows.length === 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setRows(
                  STANDARD_CHARGE_STARTER_SET.map((r) => ({
                    ...r,
                    perRun: false,
                    youthExempt: r.label.toLowerCase().includes("office"),
                  }))
                )
              }
            >
              Load stall / office / drug fee starter set
            </Button>
          )}
          <Button type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save standard charges"}
          </Button>
        </div>
      )}
    </div>
  );
}
