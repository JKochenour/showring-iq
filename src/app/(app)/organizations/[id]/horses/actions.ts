"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission } from "@/lib/authz";
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
import { normalizeSex, normalizeStatus, normalizeYear } from "@/lib/import/normalize";

export type ActionResult = { error?: string };

const MAX_IMPORT_ROWS = 1000;

export type ImportRowResult = {
  row: number;
  name: string;
  status: "created" | "skipped" | "error";
  message?: string;
};

export type ImportSummary = {
  created: number;
  skipped: number;
  errors: number;
  results: ImportRowResult[];
};

const importHorseRowSchema = createHorseSchema.omit({ organizationId: true });

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

  if (error) {
    if (error.message.includes("violates foreign key constraint")) {
      return {
        error:
          "This horse has show entries and can't be deleted. Scratch its entries instead.",
      };
    }
    return { error: error.message };
  }
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

export type ImportHorseRow = {
  registeredName?: string;
  barnName?: string;
  breed?: string;
  sex?: string;
  color?: string;
  foalYear?: string;
  sire?: string;
  dam?: string;
  notes?: string;
  ownerName?: string;
  registrationAssociation?: string;
  registrationNumber?: string;
  competitionLicenseNumber?: string;
  registrationStatus?: string;
};

export async function bulkImportHorses(
  organizationId: string,
  rows: ImportHorseRow[]
): Promise<ImportSummary | ActionResult> {
  if (!(await hasOrgPermission(organizationId, "horse.create"))) {
    return { error: "You don't have permission to add horses to this organization." };
  }
  const canAddRegistration = await hasOrgPermission(organizationId, "membership.edit");
  const canAddOwnership = await hasOrgPermission(organizationId, "ownership.edit");

  const supabase = await createClient();
  const input = rows.slice(0, MAX_IMPORT_ROWS);

  const [{ data: existingHorses }, { data: people }] = await Promise.all([
    supabase.from("horses").select("registered_name").eq("organization_id", organizationId),
    canAddOwnership
      ? supabase.from("people").select("id, first_name, last_name").eq("organization_id", organizationId)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
  ]);

  const seen = new Set((existingHorses ?? []).map((h) => h.registered_name.trim().toLowerCase()));
  const peopleByName = new Map(
    (people ?? []).map((p) => [`${p.first_name} ${p.last_name}`.trim().toLowerCase(), p.id])
  );

  const results: ImportRowResult[] = [];

  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const rowNum = i + 1;
    const displayName = raw.registeredName?.trim() || `Row ${rowNum}`;

    const sex = normalizeSex(raw.sex);
    const parsed = importHorseRowSchema.safeParse({
      registeredName: raw.registeredName ?? "",
      barnName: raw.barnName ?? "",
      breed: raw.breed ?? "",
      sex: sex ?? "",
      color: raw.color ?? "",
      foalYear: normalizeYear(raw.foalYear) ?? "",
      sire: raw.sire ?? "",
      dam: raw.dam ?? "",
      notes: raw.notes ?? "",
    });

    if (!parsed.success) {
      results.push({
        row: rowNum,
        name: displayName,
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }
    const d = parsed.data;

    const key = d.registeredName.trim().toLowerCase();
    if (seen.has(key)) {
      results.push({ row: rowNum, name: displayName, status: "skipped", message: "Already exists" });
      continue;
    }

    const { data: created, error } = await supabase
      .from("horses")
      .insert({
        organization_id: organizationId,
        registered_name: d.registeredName,
        barn_name: d.barnName || null,
        breed: d.breed || null,
        sex: d.sex || null,
        color: d.color || null,
        foal_year: d.foalYear ?? null,
        sire: d.sire || null,
        dam: d.dam || null,
        notes: d.notes || null,
      })
      .select("id")
      .maybeSingle();

    if (error || !created) {
      results.push({
        row: rowNum,
        name: displayName,
        status: "error",
        message: error?.message ?? "Not created — check permissions.",
      });
      continue;
    }
    seen.add(key);

    const notes: string[] = [];

    if (
      canAddRegistration &&
      raw.registrationAssociation?.trim() &&
      (raw.registrationNumber?.trim() || raw.competitionLicenseNumber?.trim())
    ) {
      await supabase.from("horse_registrations").insert({
        horse_id: created.id,
        organization_id: organizationId,
        association: raw.registrationAssociation.trim(),
        registration_number: raw.registrationNumber?.trim() || null,
        competition_license_number: raw.competitionLicenseNumber?.trim() || null,
        status: normalizeStatus(raw.registrationStatus),
      });
    }

    if (canAddOwnership && raw.ownerName?.trim()) {
      const ownerId = peopleByName.get(raw.ownerName.trim().toLowerCase());
      if (ownerId) {
        await supabase.from("horse_ownerships").insert({
          horse_id: created.id,
          organization_id: organizationId,
          owner_person_id: ownerId,
          percentage: 100,
        });
      } else {
        notes.push(`Owner "${raw.ownerName.trim()}" not found — add ownership manually`);
      }
    }

    if (raw.sex?.trim() && !sex) notes.push(`Unrecognized sex "${raw.sex.trim()}" ignored`);

    results.push({
      row: rowNum,
      name: displayName,
      status: "created",
      message: notes.length > 0 ? notes.join("; ") : undefined,
    });
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  if (created > 0) {
    await supabase.rpc("log_audit", {
      p_org: organizationId,
      p_action: "horse.bulk_imported",
      p_entity_type: "horses",
      p_entity_id: null,
      p_old: null,
      p_new: { created, skipped, errors, source: "csv" },
    });
  }

  revalidatePath(`/organizations/${organizationId}/horses`);
  return { created, skipped, errors, results };
}
