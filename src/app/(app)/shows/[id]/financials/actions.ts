"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import {
  addMiscChargeSchema,
  recordPaymentSchema,
  recordRefundSchema,
  type AddMiscChargeInput,
  type RecordPaymentInput,
  type RecordRefundInput,
} from "@/lib/validation/billing";

export type ActionResult = { error?: string };

export async function addMiscCharge(
  input: AddMiscChargeInput,
  showId: string
): Promise<ActionResult> {
  const parsed = addMiscChargeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  // The total is unit x quantity, computed in the RPC — never sent from
  // the browser.
  const { error } = await supabase.rpc("add_misc_charge_qty", {
    p_show: showId,
    p_person: d.personId,
    p_description: d.description,
    p_category: d.category ?? "",
    p_unit_amount_cents: dollarsToCents(d.amount),
    p_quantity: Number(d.quantity || "1"),
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${d.personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

export async function recordPayment(
  input: RecordPaymentInput,
  showId: string
): Promise<ActionResult> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    p_show: showId,
    p_person: d.personId,
    p_method: d.method,
    p_amount_cents: dollarsToCents(d.amount),
    p_reference: d.reference ?? "",
    p_notes: d.notes ?? "",
    p_apply_card_surcharge: d.applyCardSurcharge,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${d.personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

export async function removePayment(
  paymentId: string,
  reason: string,
  showId: string,
  personId: string
): Promise<ActionResult> {
  if (!reason.trim()) return { error: "A reason is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_payment", {
    p_payment: paymentId,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

export async function recordRefund(
  input: RecordRefundInput,
  showId: string,
  personId: string
): Promise<ActionResult> {
  const parsed = recordRefundSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_refund", {
    p_payment: d.paymentId,
    p_amount_cents: dollarsToCents(d.amount),
    p_reason: d.reason,
    p_method: d.method ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

export async function markPayoutsDistributed(
  showId: string,
  distributed: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payouts_distributed", {
    p_show: showId,
    p_distributed: distributed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

export async function removeMiscCharge(
  chargeId: string,
  reason: string,
  showId: string,
  personId: string
): Promise<ActionResult> {
  if (!reason.trim()) return { error: "A reason is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_misc_charge", {
    p_charge: chargeId,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

/** Edit a materialized misc charge's price (incl. $0), keeping the row so it
 * still counts (e.g. comp a camper while keeping the head count). */
export async function updateMiscChargeAmount(
  chargeId: string,
  amount: string,
  reason: string,
  showId: string,
  personId: string
): Promise<ActionResult> {
  if (!reason.trim()) return { error: "A reason is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_misc_charge_amount", {
    p_charge: chargeId,
    p_amount_cents: dollarsToCents(amount),
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

/** Override a computed run fee's total for one entry (e.g. comp a video fee).
 * amount "0" comps it while the line still shows. */
export async function setRunFeeOverride(
  entryId: string,
  feeKey: string,
  amount: string,
  reason: string,
  showId: string,
  personId: string
): Promise<ActionResult> {
  if (!reason.trim()) return { error: "A reason is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_run_fee_override", {
    p_entry: entryId,
    p_fee_key: feeKey,
    p_amount_cents: dollarsToCents(amount),
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

/** Clear a run-fee override, resetting it to the computed amount. */
export async function clearRunFeeOverride(
  entryId: string,
  feeKey: string,
  reason: string,
  showId: string,
  personId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_run_fee_override", {
    p_entry: entryId,
    p_fee_key: feeKey,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${personId}`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}
