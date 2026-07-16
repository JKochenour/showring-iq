"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addMiscCharge,
  removeMiscCharge,
  updateMiscChargeAmount,
} from "@/app/(app)/shows/[id]/financials/actions";
import {
  addMiscChargeSchema,
  CHARGE_CATEGORY_SUGGESTIONS,
  type AddMiscChargeInput,
} from "@/lib/validation/billing";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { centsToInput, formatCents } from "@/lib/money";
import type { PersonBillCharge } from "@/lib/billing";

export function MiscChargeManager({
  showId,
  personId,
  charges,
  canEdit,
}: {
  showId: string;
  personId: string;
  charges: PersonBillCharge[];
  canEdit: boolean;
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AddMiscChargeInput>({
    resolver: zodResolver(addMiscChargeSchema),
    defaultValues: { showId, personId, description: "", category: "", amount: "" },
  });

  const onSubmit = (values: AddMiscChargeInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await addMiscCharge(values, showId);
      if (result?.error) setServerError(result.error);
      else reset({ showId, personId, description: "", category: "", amount: "" });
    });
  };

  const remove = async (charge: PersonBillCharge) => {
    const result = await confirm({
      title: "Remove charge",
      tone: "danger",
      message: `Remove "${charge.description}" (${formatCents(charge.amountCents)})?`,
      confirmLabel: "Remove",
      fields: [
        { name: "reason", label: "Reason (required)", type: "textarea", required: true },
      ],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await removeMiscCharge(charge.id, result.reason, showId, personId);
      if (res?.error) setServerError(res.error);
    });
  };

  const editPrice = async (charge: PersonBillCharge) => {
    const result = await confirm({
      title: `Edit price — ${charge.description}`,
      message: "Set a new price. $0 keeps the line (so it still counts) but charges nothing.",
      confirmLabel: "Save price",
      fields: [
        {
          name: "amount",
          label: "New price ($)",
          type: "text",
          defaultValue: centsToInput(charge.amountCents),
          required: true,
        },
        { name: "reason", label: "Reason (required)", type: "textarea", required: true },
      ],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await updateMiscChargeAmount(
        charge.id,
        result.amount,
        result.reason,
        showId,
        personId
      );
      if (res?.error) setServerError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {serverError && <Alert>{serverError}</Alert>}

      {charges.length > 0 && (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {charges.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{c.description}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{c.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatCents(c.amountCents)}</span>
                {canEdit && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => editPrice(c)}
                    >
                      Edit price
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => remove(c)}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <input type="hidden" {...register("showId")} />
          <input type="hidden" {...register("personId")} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="mc-description">Description</Label>
              <Input
                id="mc-description"
                placeholder="e.g. 3 bags of ice"
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>
            <div>
              <Label htmlFor="mc-category">Category</Label>
              <Input id="mc-category" placeholder="Other" {...register("category")} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CHARGE_CATEGORY_SUGGESTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("category", c)}
                    className="rounded-full border border-stone-300 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="mc-amount">Amount ($)</Label>
              <Input id="mc-amount" placeholder="0.00" {...register("amount")} />
              <FieldError message={errors.amount?.message} />
            </div>
          </div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? "Adding…" : "Add charge"}
          </Button>
        </form>
      )}
    </div>
  );
}
