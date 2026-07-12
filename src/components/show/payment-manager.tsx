"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  recordPayment,
  recordRefund,
  removePayment,
} from "@/app/(app)/shows/[id]/financials/actions";
import {
  PAYMENT_METHODS,
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/lib/validation/billing";
import { Alert, Button, FieldError, Input, Label, Select } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { formatCents } from "@/lib/money";
import type { PersonBillPayment } from "@/lib/billing";

const METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

export function PaymentManager({
  showId,
  personId,
  payments,
  canEdit,
}: {
  showId: string;
  personId: string;
  payments: PersonBillPayment[];
  canEdit: boolean;
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      showId,
      personId,
      method: "cash",
      amount: "",
      reference: "",
      notes: "",
    },
  });

  const onSubmit = (values: RecordPaymentInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await recordPayment(values, showId);
      if (result?.error) setServerError(result.error);
      else
        reset({ showId, personId, method: "cash", amount: "", reference: "", notes: "" });
    });
  };

  const remove = async (payment: PersonBillPayment) => {
    const result = await confirm({
      title: "Remove payment",
      tone: "danger",
      message: `Remove the ${METHOD_LABELS[payment.method]} payment of ${formatCents(payment.amountCents)}? This is for entries made in error — the payment never really happened. The removal is audit-logged with the amounts. To return money that WAS received, use Refund instead.`,
      confirmLabel: "Remove",
      fields: [
        { name: "reason", label: "Reason (required)", type: "textarea", required: true },
      ],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await removePayment(payment.id, result.reason, showId, personId);
      if (res?.error) setServerError(res.error);
    });
  };

  const refund = async (payment: PersonBillPayment) => {
    const refundable = payment.amountCents - payment.refundedCents;
    const result = await confirm({
      title: "Refund payment",
      tone: "danger",
      message: `Refund up to ${formatCents(refundable)} of this ${METHOD_LABELS[payment.method]} payment. Recorded as its own line, so the original payment stays in the history.`,
      confirmLabel: "Record refund",
      fields: [
        {
          name: "amount",
          label: `Amount ($, up to ${formatCents(refundable)})`,
          defaultValue: (refundable / 100).toFixed(2),
        },
        {
          name: "method",
          label: "Refunded via",
          type: "select",
          defaultValue: payment.method,
          options: PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
        },
        { name: "reason", label: "Reason (required)", type: "textarea", required: true },
      ],
    });
    if (!result) return;
    startTransition(async () => {
      const res = await recordRefund(
        {
          paymentId: payment.id,
          amount: result.amount,
          reason: result.reason,
          method: result.method as "cash" | "check" | "card" | "other",
        },
        showId,
        personId
      );
      if (res?.error) setServerError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {serverError && <Alert>{serverError}</Alert>}

      {payments.length > 0 && (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {payments.map((p) => {
            const refundable = p.amountCents - p.refundedCents;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.isRefund && (
                      <span className="mr-1 text-amber-600 dark:text-amber-400">
                        Refund —
                      </span>
                    )}
                    {METHOD_LABELS[p.method]}
                    {p.reference && (
                      <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
                        {p.reference}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {p.notes && ` · ${p.notes}`}
                    {!p.isRefund && p.refundedCents > 0 &&
                      ` · ${formatCents(p.refundedCents)} refunded`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${p.isRefund ? "text-amber-600 dark:text-amber-400" : ""}`}
                  >
                    {p.isRefund ? "−" : ""}
                    {formatCents(p.amountCents)}
                  </span>
                  {canEdit && !p.isRefund && refundable > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => refund(p)}
                    >
                      Refund
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => remove(p)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <input type="hidden" {...register("showId")} />
          <input type="hidden" {...register("personId")} />
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="pm-method">Method</Label>
              <Select id="pm-method" {...register("method")}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pm-amount">Amount ($)</Label>
              <Input id="pm-amount" placeholder="0.00" {...register("amount")} />
              <FieldError message={errors.amount?.message} />
            </div>
            <div>
              <Label htmlFor="pm-reference">Reference (optional)</Label>
              <Input
                id="pm-reference"
                placeholder="check # / receipt #"
                {...register("reference")}
              />
              <FieldError message={errors.reference?.message} />
            </div>
            <div>
              <Label htmlFor="pm-notes">Notes (optional)</Label>
              <Input id="pm-notes" {...register("notes")} />
            </div>
          </div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? "Recording…" : "Record payment"}
          </Button>
        </form>
      )}
    </div>
  );
}
