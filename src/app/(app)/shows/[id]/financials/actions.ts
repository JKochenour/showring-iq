"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import { addMiscChargeSchema, type AddMiscChargeInput } from "@/lib/validation/billing";

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
  const { error } = await supabase.rpc("add_misc_charge", {
    p_show: showId,
    p_person: d.personId,
    p_description: d.description,
    p_category: d.category ?? "",
    p_amount_cents: dollarsToCents(d.amount),
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials/${d.personId}`);
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
