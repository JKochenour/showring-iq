"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission } from "@/lib/authz";
import {
  addMembershipSchema,
  createPersonSchema,
  updatePersonSchema,
  type AddMembershipInput,
  type CreatePersonInput,
  type UpdatePersonInput,
} from "@/lib/validation/person";
import { normalizeDate, normalizeRoles, normalizeStatus } from "@/lib/import/normalize";

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

const importPersonRowSchema = createPersonSchema.omit({ organizationId: true });

export async function createPerson(
  input: CreatePersonInput
): Promise<ActionResult> {
  const parsed = createPersonSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("people")
    .insert({
      organization_id: d.organizationId,
      first_name: d.firstName,
      last_name: d.lastName,
      preferred_name: d.preferredName || null,
      email: d.email || null,
      phone: d.phone || null,
      city: d.city || null,
      state: d.state || null,
      birthdate: d.birthdate || null,
      roles: d.roles,
      notes: d.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!created) {
    return { error: "Person was not created. You may lack the person.create permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: d.organizationId,
    p_action: "person.created",
    p_entity_type: "person",
    p_entity_id: created.id,
    p_old: null,
    p_new: { name: `${d.firstName} ${d.lastName}`, roles: d.roles },
  });

  revalidatePath(`/organizations/${d.organizationId}/people`);
  redirect(`/organizations/${d.organizationId}/people/${created.id}`);
}

export async function updatePerson(
  input: UpdatePersonInput
): Promise<ActionResult> {
  const parsed = updatePersonSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("people")
    .select(
      "organization_id, first_name, last_name, preferred_name, email, phone, city, state, birthdate, roles, notes"
    )
    .eq("id", d.personId)
    .maybeSingle();
  if (!before) return { error: "Person not found." };

  const updates = {
    first_name: d.firstName,
    last_name: d.lastName,
    preferred_name: d.preferredName || null,
    email: d.email || null,
    phone: d.phone || null,
    city: d.city || null,
    state: d.state || null,
    birthdate: d.birthdate || null,
    roles: d.roles,
    notes: d.notes || null,
  };

  const { data: updated, error } = await supabase
    .from("people")
    .update(updates)
    .eq("id", d.personId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "Update was not applied. You may lack the person.edit permission." };
  }

  const { organization_id, ...beforeValues } = before;
  await supabase.rpc("log_audit", {
    p_org: organization_id,
    p_action: "person.updated",
    p_entity_type: "person",
    p_entity_id: d.personId,
    p_old: beforeValues,
    p_new: updates,
  });

  revalidatePath(`/organizations/${organization_id}/people`, "layout");
  return {};
}

export async function deletePerson(personId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("organization_id, first_name, last_name")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { error: "Person not found." };

  const { data: deleted, error } = await supabase
    .from("people")
    .delete()
    .eq("id", personId)
    .select("id");

  if (error) {
    if (error.message.includes("violates foreign key constraint")) {
      return {
        error:
          "This person has show entries and can't be deleted. Scratch their entries instead.",
      };
    }
    return { error: error.message };
  }
  if (!deleted || deleted.length === 0) {
    return { error: "Delete was not applied. You may lack the person.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: person.organization_id,
    p_action: "person.deleted",
    p_entity_type: "person",
    p_entity_id: personId,
    p_old: { name: `${person.first_name} ${person.last_name}` },
    p_new: null,
  });

  revalidatePath(`/organizations/${person.organization_id}/people`);
  redirect(`/organizations/${person.organization_id}/people`);
}

export async function addMembership(
  input: AddMembershipInput
): Promise<ActionResult> {
  const parsed = addMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("organization_id")
    .eq("id", d.personId)
    .maybeSingle();
  if (!person) return { error: "Person not found." };

  const { data: created, error } = await supabase
    .from("person_memberships")
    .insert({
      person_id: d.personId,
      organization_id: person.organization_id,
      association: d.association,
      membership_number: d.membershipNumber,
      membership_type: d.membershipType || null,
      status: d.status,
      expiration_date: d.expirationDate || null,
      notes: d.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!created) {
    return { error: "Membership was not added. You may lack the membership.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: person.organization_id,
    p_action: "person.membership_added",
    p_entity_type: "person_membership",
    p_entity_id: created.id,
    p_old: null,
    p_new: {
      person_id: d.personId,
      association: d.association,
      number: d.membershipNumber,
      status: d.status,
    },
  });

  revalidatePath(`/organizations/${person.organization_id}/people/${d.personId}`);
  return {};
}

export async function removeMembership(
  membershipId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("person_memberships")
    .select("organization_id, person_id, association, membership_number")
    .eq("id", membershipId)
    .maybeSingle();
  if (!membership) return { error: "Membership not found." };

  const { data: deleted, error } = await supabase
    .from("person_memberships")
    .delete()
    .eq("id", membershipId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Remove was not applied. You may lack the membership.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: membership.organization_id,
    p_action: "person.membership_removed",
    p_entity_type: "person_membership",
    p_entity_id: membershipId,
    p_old: {
      association: membership.association,
      number: membership.membership_number,
    },
    p_new: null,
  });

  revalidatePath(
    `/organizations/${membership.organization_id}/people/${membership.person_id}`
  );
  return {};
}

export type ImportPersonRow = {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birthdate?: string;
  roles?: string;
  notes?: string;
  membershipAssociation?: string;
  membershipNumber?: string;
  membershipStatus?: string;
};

export async function bulkImportPeople(
  organizationId: string,
  rows: ImportPersonRow[]
): Promise<ImportSummary | ActionResult> {
  if (!(await hasOrgPermission(organizationId, "person.create"))) {
    return { error: "You don't have permission to add people to this organization." };
  }
  const canAddMembership = await hasOrgPermission(organizationId, "membership.edit");

  const supabase = await createClient();
  const input = rows.slice(0, MAX_IMPORT_ROWS);

  const { data: existing } = await supabase
    .from("people")
    .select("first_name, last_name")
    .eq("organization_id", organizationId);

  const seen = new Set(
    (existing ?? []).map((p) => `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`)
  );

  const results: ImportRowResult[] = [];

  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const rowNum = i + 1;
    const displayName = `${raw.firstName ?? ""} ${raw.lastName ?? ""}`.trim() || `Row ${rowNum}`;

    const { roles, unrecognized } = normalizeRoles(raw.roles);
    const parsed = importPersonRowSchema.safeParse({
      firstName: raw.firstName ?? "",
      lastName: raw.lastName ?? "",
      preferredName: raw.preferredName ?? "",
      email: raw.email ?? "",
      phone: raw.phone ?? "",
      city: raw.city ?? "",
      state: raw.state ?? "",
      birthdate: normalizeDate(raw.birthdate) ?? "",
      roles,
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

    const key = `${d.firstName.trim().toLowerCase()}|${d.lastName.trim().toLowerCase()}`;
    if (seen.has(key)) {
      results.push({ row: rowNum, name: displayName, status: "skipped", message: "Already exists" });
      continue;
    }

    const { data: created, error } = await supabase
      .from("people")
      .insert({
        organization_id: organizationId,
        first_name: d.firstName,
        last_name: d.lastName,
        preferred_name: d.preferredName || null,
        email: d.email || null,
        phone: d.phone || null,
        city: d.city || null,
        state: d.state || null,
        birthdate: d.birthdate || null,
        roles: d.roles,
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

    if (canAddMembership && raw.membershipAssociation?.trim() && raw.membershipNumber?.trim()) {
      await supabase.from("person_memberships").insert({
        person_id: created.id,
        organization_id: organizationId,
        association: raw.membershipAssociation.trim(),
        membership_number: raw.membershipNumber.trim(),
        status: normalizeStatus(raw.membershipStatus),
      });
    }

    const note = unrecognized.length > 0 ? `Unrecognized role(s) ignored: ${unrecognized.join(", ")}` : undefined;
    results.push({ row: rowNum, name: displayName, status: "created", message: note });
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  if (created > 0) {
    await supabase.rpc("log_audit", {
      p_org: organizationId,
      p_action: "person.bulk_imported",
      p_entity_type: "people",
      p_entity_id: null,
      p_old: null,
      p_new: { created, skipped, errors, source: "csv" },
    });
  }

  revalidatePath(`/organizations/${organizationId}/people`);
  return { created, skipped, errors, results };
}

export type BulkDeleteRowResult = { name: string; status: "deleted" | "error"; message?: string };
export type BulkDeleteSummary = { deleted: number; failed: number; results: BulkDeleteRowResult[] };

export async function bulkDeletePeople(
  organizationId: string,
  personIds: string[]
): Promise<BulkDeleteSummary | ActionResult> {
  if (!(await hasOrgPermission(organizationId, "person.edit"))) {
    return { error: "You don't have permission to delete people in this organization." };
  }

  const supabase = await createClient();
  const ids = Array.from(new Set(personIds)).slice(0, MAX_IMPORT_ROWS);

  const results: BulkDeleteRowResult[] = [];
  const deletedNames: string[] = [];

  for (const personId of ids) {
    const { data: person } = await supabase
      .from("people")
      .select("first_name, last_name")
      .eq("id", personId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const name = person ? `${person.first_name} ${person.last_name}` : personId;

    const { data: removed, error } = await supabase
      .from("people")
      .delete()
      .eq("id", personId)
      .eq("organization_id", organizationId)
      .select("id");

    if (error) {
      const message = error.message.includes("violates foreign key constraint")
        ? "Has show entries — scratch their entries first"
        : error.message;
      results.push({ name, status: "error", message });
      continue;
    }
    if (!removed || removed.length === 0) {
      results.push({ name, status: "error", message: "Not deleted — check permissions." });
      continue;
    }
    deletedNames.push(name);
    results.push({ name, status: "deleted" });
  }

  if (deletedNames.length > 0) {
    await supabase.rpc("log_audit", {
      p_org: organizationId,
      p_action: "person.bulk_deleted",
      p_entity_type: "people",
      p_entity_id: null,
      p_old: { count: deletedNames.length, names: deletedNames.slice(0, 100) },
      p_new: null,
    });
  }

  revalidatePath(`/organizations/${organizationId}/people`);
  return { deleted: deletedNames.length, failed: results.length - deletedNames.length, results };
}
