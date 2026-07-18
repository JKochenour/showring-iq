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
import { unitPriceHolds, type PersonBillCharge } from "@/lib/billing";

export type CatalogItem = {
  label: string;
  category: string;
  unitAmountCents: number;
};

const EMPTY_FORM = { description: "", category: "", amount: "", quantity: "1" };

export function MiscChargeManager({
  showId,
  personId,
  charges,
  catalog,
  canEdit,
}: {
  showId: string;
  personId: string;
  charges: PersonBillCharge[];
  /** The show's price list — picking an item fills the form. */
  catalog: CatalogItem[];
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
    watch,
    formState: { errors },
  } = useForm<AddMiscChargeInput>({
    resolver: zodResolver(addMiscChargeSchema),
    defaultValues: { showId, personId, ...EMPTY_FORM },
  });

  // Show the arithmetic before it is committed, so a mis-keyed quantity
  // is caught here rather than on the exhibitor's bill.
  const unitInput = watch("amount");
  const qtyInput = watch("quantity");
  const unitCents = /^\d+(\.\d{1,2})?$/.test((unitInput ?? "").trim())
    ? Math.round(parseFloat(unitInput) * 100)
    : null;
  const qty = /^\d{1,3}$/.test((qtyInput ?? "").trim()) ? Number(qtyInput) : null;
  const previewCents = unitCents !== null && qty !== null ? unitCents * qty : null;

  const onSubmit = (values: AddMiscChargeInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await addMiscCharge(values, showId);
      if (result?.error) setServerError(result.error);
      else reset({ showId, personId, ...EMPTY_FORM });
    });
  };

  const pickCatalogItem = (item: CatalogItem) => {
    setValue("description", item.label);
    setValue("category", item.category);
    setValue("amount", centsToInput(item.unitAmountCents));
    setValue("quantity", "1");
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
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {c.category}
                  {unitPriceHolds(c) &&
                    ` · ${c.quantity} × ${formatCents(c.unitAmountCents!)}`}
                </p>
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
          {catalog.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">
                From this show&apos;s price list — pick one, then set the
                quantity.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {catalog.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => pickCatalogItem(item)}
                    className="rounded-full border border-stone-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    {item.label}{" "}
                    <span className="font-mono text-stone-500 dark:text-stone-400">
                      {formatCents(item.unitAmountCents)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
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
              <Label htmlFor="mc-amount">Price each ($)</Label>
              <Input id="mc-amount" placeholder="0.00" {...register("amount")} />
              <FieldError message={errors.amount?.message} />
            </div>
            <div>
              <Label htmlFor="mc-quantity">Qty</Label>
              <Input
                id="mc-quantity"
                inputMode="numeric"
                placeholder="1"
                {...register("quantity")}
              />
              <FieldError message={errors.quantity?.message} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? "Adding…" : "Add charge"}
            </Button>
            {previewCents !== null && qty !== null && qty > 1 && (
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {qty} × {formatCents(unitCents!)} ={" "}
                <span className="font-semibold">{formatCents(previewCents)}</span>
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
