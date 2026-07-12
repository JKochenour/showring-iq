"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import {
  requestReservationSchema,
  updateReservationTypesSchema,
  type RequestReservationInput,
  type UpdateReservationTypesInput,
} from "@/lib/validation/reservation";

export type ActionResult = { error?: string };

export async function updateReservationTypes(
  input: UpdateReservationTypesInput
): Promise<ActionResult> {
  const parsed = updateReservationTypesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const types = d.types
    .filter((t) => t.key.trim() && t.label.trim())
    .map((t) => ({
      key: t.key.trim(),
      label: t.label.trim(),
      unitPriceCents: t.unitPrice.trim() ? dollarsToCents(t.unitPrice) : 0,
      slotOptions: (t.slotOptionsText ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }));

  const keys = new Set(types.map((t) => t.key));
  if (keys.size !== types.length) {
    return { error: "Reservation type keys must be unique." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("shows")
    .update({ reservation_types: types })
    .eq("id", d.showId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error: "Update was not applied. You may lack the show.edit permission, or the show is locked/archived.",
    };
  }

  revalidatePath(`/shows/${d.showId}/reservations`);
  return {};
}

export async function requestReservation(
  input: RequestReservationInput
): Promise<ActionResult> {
  const parsed = requestReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_reservation", {
    p_show: d.showId,
    p_person: d.personId,
    p_type_key: d.typeKey,
    p_quantity: d.quantity,
    p_slot_label: d.slotLabel || null,
    p_notes: d.notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${d.showId}/reservations`);
  return {};
}

export async function confirmReservation(
  reservationId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_reservation", {
    p_reservation: reservationId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/reservations`);
  revalidatePath(`/shows/${showId}/financials`);
  return {};
}

export async function cancelReservation(
  reservationId: string,
  showId: string,
  reason?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation: reservationId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/reservations`);
  return {};
}
