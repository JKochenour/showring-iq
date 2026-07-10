"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addOwnershipSchema,
  addRegistrationSchema,
  createHorseSchema,
  updateHorseSchema,
  type AddOwnershipInput,
  type AddRegistrationInput,
  type CreateHorseInput,
  type UpdateHorseInput,
} from "@/lib/validation/horse";

export type ActionResult = { error?: string };

function horseValues(d: CreateHorseInput | UpdateHorseInput) {
  return {
    registered_name: d.registeredName,
    barn_name: d.barnName || null,
    breed: d.breed || null,
    sex: d.sex || null,
    color: d.color || null,
    foal_year: d.foalYear ?? null,
    sire: d.sire || null,
    dam: d.dam || null,
    notes: d.notes || null,
  };
}

export async function createHorse(
  input: CreateHorseInput
): Promise<ActionResult> {
  const parsed = createHorseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("horses")
    .insert({ organization_id: d.organizationId, ...horseValues(d) })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!created) {
    return { error: "Horse was not created. You may lack the horse.create permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: d.organizationId,
    p_action: "horse.created",
    p_entity_type: "horse",
    p_entity_id: created.id,
    p_old: null,
    p_new: { registered_name: d.registeredName },
  });

  revalidatePath(`/organizations/${d.organizationId}/horses`);
  redirect(`/organizations/${d.organizationId}/horses/${created.id}`);
}

export async function updateHorse(
  input: UpdateHorseInput
): Promise<ActionResult> {
  const parsed = updateHorseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("horses")
    .select(
      "organization_id, registered_name, barn_name, breed, sex, color, foal_year, sire, dam, notes"
    )
    .eq("id", d.horseId)
    .maybeSingle();
  if (!before) return { error: "Horse not found." };

  const updates = horseValues(d);
  const { data: updated, error } = await supabase
    .from("horses")
    .update(updates)
    .eq("id", d.horseId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "Update was not applied. You may lack the horse.edit permission." };
  }

  const { organization_id, ...beforeValues } = before;
  await supabase.rpc("log_audit", {
    p_org: organization_id,
    p_action: "horse.updated",
    p_entity_type: "horse",
    p_entity_id: d.horseId,
    p_old: beforeValues,
    p_new: updates,
  });

  revalidatePath(`/organizations/${organization_id}/horses`, "layout");
  return {};
}

export async function deleteHorse(horseId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: horse } = await supabase
    .from("horses")
    .select("organization_id, registered_name")
    .eq("id", horseId)
    .maybeSingle();
  if (!horse) return { error: "Horse not found." };

  const { data: deleted, error } = await supabase
    .from("horses")
    .delete()
    .eq("id", horseId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Delete was not applied. You may lack the horse.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: horse.organization_id,
    p_action: "horse.deleted",
    p_entity_type: "horse",
    p_entity_id: horseId,
    p_old: { registered_name: horse.registered_name },
    p_new: null,
  });

  revalidatePath(`/organizations/${horse.organization_id}/horses`);
  redirect(`/organizations/${horse.organization_id}/horses`);
}

export async function addRegistration(
  input: AddRegistrationInput
): Promise<ActionResult> {
  const parsed = addRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: horse } = await supabase
    .from("horses")
    .select("organization_id")
    .eq("id", d.horseId)
    .maybeSingle();
  if (!horse) return { error: "Horse not found." };

  const { data: created, error } = await supabase
    .from("horse_registrations")
    .insert({
      horse_id: d.horseId,
      organization_id: horse.organization_id,
      association: d.association,
      registration_number: d.registrationNumber || null,
      competition_license_number: d.competitionLicenseNumber || null,
      status: d.status,
      expiration_date: d.expirationDate || null,
      notes: d.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!created) {
    return { error: "Registration was not added. You may lack the membership.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: horse.organization_id,
    p_action: "horse.registration_added",
    p_entity_type: "horse_registration",
    p_entity_id: created.id,
    p_old: null,
    p_new: {
      horse_id: d.horseId,
      association: d.association,
      registration_number: d.registrationNumber ?? null,
      competition_license_number: d.competitionLicenseNumber ?? null,
    },
  });

  revalidatePath(`/organizations/${horse.organization_id}/horses/${d.horseId}`);
  return {};
}

export async function removeRegistration(
  registrationId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: reg } = await supabase
    .from("horse_registrations")
    .select("organization_id, horse_id, association, registration_number, competition_license_number")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Registration not found." };

  const { data: deleted, error } = await supabase
    .from("horse_registrations")
    .delete()
    .eq("id", registrationId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Remove was not applied. You may lack the membership.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: reg.organization_id,
    p_action: "horse.registration_removed",
    p_entity_type: "horse_registration",
    p_entity_id: registrationId,
    p_old: {
      association: reg.association,
      registration_number: reg.registration_number,
      competition_license_number: reg.competition_license_number,
    },
    p_new: null,
  });

  revalidatePath(`/organizations/${reg.organization_id}/horses/${reg.horse_id}`);
  return {};
}

export async function addOwnership(
  input: AddOwnershipInput
): Promise<ActionResult> {
  const parsed = addOwnershipSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: horse } = await supabase
    .from("horses")
    .select("organization_id")
    .eq("id", d.horseId)
    .maybeSingle();
  if (!horse) return { error: "Horse not found." };

  const { data: created, error } = await supabase
    .from("horse_ownerships")
    .insert({
      horse_id: d.horseId,
      organization_id: horse.organization_id,
      owner_person_id: d.ownerPersonId,
      percentage: d.percentage,
      start_date: d.startDate || null,
      notes: d.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("horse_ownerships_horse_id_owner_person_id_key")) {
      return { error: "That person is already an owner of this horse." };
    }
    return { error: error.message };
  }
  if (!created) {
    return { error: "Owner was not added. You may lack the ownership.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: horse.organization_id,
    p_action: "horse.ownership_added",
    p_entity_type: "horse_ownership",
    p_entity_id: created.id,
    p_old: null,
    p_new: {
      horse_id: d.horseId,
      owner_person_id: d.ownerPersonId,
      percentage: d.percentage,
    },
  });

  revalidatePath(`/organizations/${horse.organization_id}/horses/${d.horseId}`);
  return {};
}

export async function removeOwnership(
  ownershipId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: ownership } = await supabase
    .from("horse_ownerships")
    .select("organization_id, horse_id, owner_person_id, percentage")
    .eq("id", ownershipId)
    .maybeSingle();
  if (!ownership) return { error: "Ownership record not found." };

  const { data: deleted, error } = await supabase
    .from("horse_ownerships")
    .delete()
    .eq("id", ownershipId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Remove was not applied. You may lack the ownership.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: ownership.organization_id,
    p_action: "horse.ownership_removed",
    p_entity_type: "horse_ownership",
    p_entity_id: ownershipId,
    p_old: {
      owner_person_id: ownership.owner_person_id,
      percentage: ownership.percentage,
    },
    p_new: null,
  });

  revalidatePath(
    `/organizations/${ownership.organization_id}/horses/${ownership.horse_id}`
  );
  return {};
}
