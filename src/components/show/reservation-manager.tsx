"use client";

import { useState, useTransition } from "react";
import {
  cancelReservation,
  confirmReservation,
  requestReservation,
} from "@/app/(app)/shows/[id]/reservations/actions";
import { Alert, Button, Input, Label, Select } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { formatCents } from "@/lib/money";
import type { Reservation, Show } from "@/lib/types";

export function ReservationManager({
  showId,
  types,
  people,
  reservations,
  canEdit,
}: {
  showId: string;
  types: Show["reservation_types"];
  people: { id: string; label: string }[];
  reservations: Reservation[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const [personId, setPersonId] = useState("");
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? "");
  const [quantity, setQuantity] = useState("1");
  const [slotLabel, setSlotLabel] = useState("");
  const [notes, setNotes] = useState("");

  const selectedType = types.find((t) => t.key === typeKey);

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await requestReservation({
        showId,
        personId,
        typeKey,
        quantity: parseInt(quantity, 10) || 1,
        slotLabel: slotLabel || undefined,
        notes: notes || undefined,
      });
      if (result?.error) setError(result.error);
      else {
        setPersonId("");
        setQuantity("1");
        setSlotLabel("");
        setNotes("");
      }
    });
  };

  const confirmRes = (r: Reservation) => {
    startTransition(async () => {
      const result = await confirmReservation(r.id, showId);
      if (result?.error) setError(result.error);
    });
  };

  const cancelRes = async (r: Reservation) => {
    const result = await confirm({
      title: "Cancel reservation",
      tone: "danger",
      message:
        r.status === "confirmed"
          ? "This reservation was already confirmed and charged. Cancelling it does NOT remove the charge — remove that separately on the person's bill if a refund is due."
          : "Cancel this reservation request?",
      confirmLabel: "Cancel reservation",
      fields: [{ name: "reason", label: "Reason (optional)" }],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await cancelReservation(r.id, showId, result.reason);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      {reservations.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No reservations yet.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {reservations.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">
                  {people.find((p) => p.id === r.person_id)?.label ?? "Unknown"} —{" "}
                  {r.label}
                  {r.quantity > 1 && ` ×${r.quantity}`}
                  {r.slot_label && ` (${r.slot_label})`}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {formatCents(r.quantity * r.unit_price_cents)} ·{" "}
                  <span
                    className={
                      r.status === "confirmed"
                        ? "text-green-700 dark:text-green-400"
                        : r.status === "cancelled"
                          ? "text-stone-400"
                          : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    {r.status}
                  </span>
                  {r.notes && ` · ${r.notes}`}
                </p>
              </div>
              {canEdit && r.status !== "cancelled" && (
                <div className="flex items-center gap-2">
                  {r.status === "requested" && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => confirmRes(r)}
                    >
                      Confirm &amp; charge
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => cancelRes(r)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && types.length > 0 && (
        <div className="rounded-md border border-stone-200 p-3 dark:border-stone-800">
          <p className="mb-2 text-sm font-medium">Request a reservation</p>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <Label htmlFor="res-person">Person</Label>
              <Select
                id="res-person"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">Choose…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="res-type">Type</Label>
              <Select
                id="res-type"
                value={typeKey}
                onChange={(e) => {
                  setTypeKey(e.target.value);
                  setSlotLabel("");
                }}
              >
                {types.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} ({formatCents(t.unitPriceCents)})
                  </option>
                ))}
              </Select>
            </div>
            {selectedType && selectedType.slotOptions.length > 0 ? (
              <div>
                <Label htmlFor="res-slot">Slot</Label>
                <Select
                  id="res-slot"
                  value={slotLabel}
                  onChange={(e) => setSlotLabel(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {selectedType.slotOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="res-qty">Quantity</Label>
                <Input
                  id="res-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}
            <div>
              <Label htmlFor="res-notes">Notes (optional)</Label>
              <Input
                id="res-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            disabled={isPending || !personId || !typeKey}
            onClick={submit}
          >
            {isPending ? "Requesting…" : "Request reservation"}
          </Button>
        </div>
      )}
    </div>
  );
}
