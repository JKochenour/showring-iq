"use client";

import { useState, useTransition } from "react";
import { updateReservationTypes } from "@/app/(app)/shows/[id]/reservations/actions";
import type { ReservationTypeRow } from "@/lib/validation/reservation";
import { Alert, Button, Input } from "@/components/ui";

export function ReservationTypesEditor({
  showId,
  types,
  canEdit,
}: {
  showId: string;
  types: ReservationTypeRow[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ReservationTypeRow[]>(types);

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateReservationTypes({ showId, types: rows });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Reservation types saved.</Alert>}
      <p className="text-sm text-stone-500 dark:text-stone-400">
        e.g. key <code>stall</code>, label &quot;Stall,&quot; $185. Leave slot
        choices blank for a plain quantity item; fill them in (comma-
        separated, e.g. &quot;Wed AM, Wed PM&quot;) for something like a
        warm-up slot the requester picks.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-5">
            <Input
              placeholder="key (e.g. stall)"
              value={row.key}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], key: e.target.value };
                setRows(next);
              }}
            />
            <Input
              placeholder="Label (e.g. Stall)"
              value={row.label}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], label: e.target.value };
                setRows(next);
              }}
            />
            <Input
              placeholder="0.00"
              value={row.unitPrice}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], unitPrice: e.target.value };
                setRows(next);
              }}
            />
            <Input
              className="sm:col-span-1"
              placeholder="Slot choices (optional)"
              value={row.slotOptionsText ?? ""}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], slotOptionsText: e.target.value };
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
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setRows([...rows, { key: "", label: "", unitPrice: "", slotOptionsText: "" }])
            }
          >
            Add type
          </Button>
          <Button disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save reservation types"}
          </Button>
        </div>
      )}
    </div>
  );
}
