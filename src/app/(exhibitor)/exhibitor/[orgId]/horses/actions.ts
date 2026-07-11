"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import {
  createOwnHorseSchema,
  updateOwnHorseSchema,
  type CreateOwnHorseInput,
  type UpdateOwnHorseInput,
} from "@/lib/validation/horse";

export type ActionResult = { error?: string };

export async function createOwnHorse(input: CreateOwnHorseInput): Promise<ActionResult> {
  const parsed = createOwnHorseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const { supabase } = await requireUser();

  const { data: horseId, error } = await supabase.rpc("exhibitor_create_horse", {
    p_org: d.organizationId,
    p_registered_name: d.registeredName,
    p_barn_name: d.barnName ?? "",
    p_breed: d.breed ?? "",
    p_sex: d.sex ?? "",
    p_color: d.color ?? "",
    p_foal_year: d.foalYear ?? null,
    p_sire: d.sire ?? "",
    p_dam: d.dam ?? "",
  });

  if (error) return { error: error.message };
  if (!horseId) return { error: "Horse was not created." };

  revalidatePath(`/exhibitor/${d.organizationId}/horses`);
  redirect(`/exhibitor/${d.organizationId}/horses/${horseId}`);
}

export async function updateOwnHorse(input: UpdateOwnHorseInput): Promise<ActionResult> {
  const parsed = updateOwnHorseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("exhibitor_update_horse", {
    p_horse: d.horseId,
    p_barn_name: d.barnName ?? "",
    p_breed: d.breed ?? "",
    p_sex: d.sex ?? "",
    p_color: d.color ?? "",
    p_foal_year: d.foalYear ?? null,
    p_sire: d.sire ?? "",
    p_dam: d.dam ?? "",
  });

  if (error) return { error: error.message };

  revalidatePath(`/exhibitor/${d.organizationId}/horses/${d.horseId}`);
  return {};
}
