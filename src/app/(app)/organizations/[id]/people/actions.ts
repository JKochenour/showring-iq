"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addMembershipSchema,
  createPersonSchema,
  updatePersonSchema,
  type AddMembershipInput,
  type CreatePersonInput,
  type UpdatePersonInput,
} from "@/lib/validation/person";

export type ActionResult = { error?: string };

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
