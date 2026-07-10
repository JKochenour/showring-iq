"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createOrganizationSchema,
  inviteMemberSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type InviteMemberInput,
  type UpdateOrganizationInput,
} from "@/lib/validation/organization";

export type ActionResult = { error?: string };

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<ActionResult> {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_contact_email: parsed.data.contactEmail || null,
  });

  if (error) {
    if (error.message.includes("organizations_slug_key")) {
      return { error: "That URL slug is already taken. Try another." };
    }
    return { error: error.message };
  }

  revalidatePath("/organizations");
  redirect(`/organizations/${data}`);
}

export async function updateOrganization(
  input: UpdateOrganizationInput
): Promise<ActionResult> {
  const parsed = updateOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { organizationId, name, contactEmail, website, city, state } = parsed.data;

  if (!(await hasOrgPermission(organizationId, PERMISSIONS.ORG_EDIT))) {
    return { error: "You don't have permission to edit this organization." };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("organizations")
    .select("name, contact_email, website, city, state")
    .eq("id", organizationId)
    .single();

  const updates = {
    name,
    contact_email: contactEmail || null,
    website: website || null,
    city: city || null,
    state: state || null,
  };

  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", organizationId);

  if (error) return { error: error.message };

  await supabase.rpc("log_audit", {
    p_org: organizationId,
    p_action: "organization.updated",
    p_entity_type: "organization",
    p_entity_id: organizationId,
    p_old: before ?? null,
    p_new: updates,
  });

  revalidatePath(`/organizations/${organizationId}`);
  return {};
}

export async function inviteMember(
  input: InviteMemberInput
): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member", {
    p_org: parsed.data.organizationId,
    p_email: parsed.data.email,
    p_role_id: parsed.data.roleId,
  });

  if (error) {
    if (error.message.includes("organization_invites_pending_unique")) {
      return { error: "There is already a pending invite for that email." };
    }
    return { error: error.message };
  }

  revalidatePath(`/organizations/${parsed.data.organizationId}/members`);
  return {};
}

export async function revokeInvite(
  organizationId: string,
  inviteId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_invite: inviteId });
  if (error) return { error: error.message };
  revalidatePath(`/organizations/${organizationId}/members`);
  return {};
}

export async function acceptInvite(inviteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("accept_invite", {
    p_invite: inviteId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/organizations");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role:organization_roles(key)")
    .eq("organization_id", data)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const roleKey = (membership?.role as unknown as { key: string } | null)?.key;

  if (roleKey === "exhibitor") {
    redirect("/exhibitor/dashboard");
  }
  redirect(`/organizations/${data}`);
}

export async function setMemberRole(
  organizationId: string,
  memberId: string,
  roleId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_member: memberId,
    p_role_id: roleId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/organizations/${organizationId}/members`);
  return {};
}

export async function removeMember(
  organizationId: string,
  memberId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_member: memberId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/organizations/${organizationId}/members`);
  return {};
}
