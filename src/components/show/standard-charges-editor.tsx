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
        Each of these lands on a person&apos;s bill automatically the first
        time each of their back numbers is assigned — no manual entry
        needed. Leave the list empty if this show doesn&apos;t use standard
        per-entry charges. A charge already applied to a specific bill can
        still be removed there if it doesn&apos;t apply to that entry.
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
            onClick={() => setRows([...rows, { label: "", amount: "" }])}
          >
            Add row
          </Button>
          {rows.length === 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRows(STANDARD_CHARGE_STARTER_SET.map((r) => ({ ...r })))}
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
