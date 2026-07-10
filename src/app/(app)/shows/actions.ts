"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addStaffSchema,
  createShowSchema,
  updateShowSchema,
  type AddStaffInput,
  type CreateShowInput,
  type UpdateShowInput,
} from "@/lib/validation/show";
import type { ShowStatus } from "@/lib/types";

export type ActionResult = { error?: string };

export async function createShow(input: CreateShowInput): Promise<ActionResult> {
  const parsed = createShowSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_show", {
    p_org: d.organizationId,
    p_name: d.name,
    p_slug: d.slug,
    p_start_date: d.startDate,
    p_end_date: d.endDate,
    p_timezone: d.timezone,
    p_venue_name: d.venueName || null,
    p_city: d.city || null,
    p_state: d.state || null,
    p_contact_email: d.contactEmail || null,
  });

  if (error) {
    if (error.message.includes("shows_organization_id_slug_key")) {
      return { error: "This organization already has a show with that slug." };
    }
    return { error: error.message };
  }

  revalidatePath(`/organizations/${d.organizationId}/shows`);
  redirect(`/shows/${data}/dashboard`);
}

export async function updateShow(input: UpdateShowInput): Promise<ActionResult> {
  const parsed = updateShowSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("shows")
    .select("organization_id, name, slug, start_date, end_date, timezone, venue_name, city, state, contact_name, contact_email, contact_phone, description, nrha_show_number")
    .eq("id", d.showId)
    .maybeSingle();
  if (!before) return { error: "Show not found." };

  const updates = {
    name: d.name,
    slug: d.slug,
    start_date: d.startDate,
    end_date: d.endDate,
    timezone: d.timezone,
    venue_name: d.venueName || null,
    city: d.city || null,
    state: d.state || null,
    contact_name: d.contactName || null,
    contact_email: d.contactEmail || null,
    contact_phone: d.contactPhone || null,
    description: d.description || null,
    nrha_show_number: d.nrhaShowNumber || null,
  };

  // RLS enforces show.edit and blocks locked/archived shows
  const { data: updated, error } = await supabase
    .from("shows")
    .update(updates)
    .eq("id", d.showId)
    .select("id");

  if (error) {
    if (error.message.includes("shows_organization_id_slug_key")) {
      return { error: "This organization already has a show with that slug." };
    }
    return { error: error.message };
  }
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the show.edit permission, or the show is locked/archived.",
    };
  }

  const { organization_id, ...beforeValues } = before;
  await supabase.rpc("log_audit", {
    p_org: organization_id,
    p_action: "show.updated",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: beforeValues,
    p_new: updates,
  });

  revalidatePath(`/shows/${d.showId}`, "layout");
  return {};
}

export async function setShowStatus(
  showId: string,
  status: ShowStatus,
  reason?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_show_status", {
    p_show: showId,
    p_status: status,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/shows/${showId}`, "layout");
  return {};
}

export async function deleteShow(
  showId: string,
  organizationId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("name, slug, status")
    .eq("id", showId)
    .maybeSingle();
  if (!show) return { error: "Show not found." };

  // RLS: requires show.delete and draft status
  const { data: deleted, error } = await supabase
    .from("shows")
    .delete()
    .eq("id", showId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Delete was not applied. Only draft shows can be deleted, and it requires the show.delete permission.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: organizationId,
    p_action: "show.deleted",
    p_entity_type: "show",
    p_entity_id: showId,
    p_old: { name: show.name, slug: show.slug, status: show.status },
    p_new: null,
  });

  revalidatePath(`/organizations/${organizationId}/shows`);
  redirect(`/organizations/${organizationId}/shows`);
}

export async function addStaff(input: AddStaffInput): Promise<ActionResult> {
  const parsed = addStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: show } = await supabase
    .from("shows")
    .select("organization_id")
    .eq("id", d.showId)
    .maybeSingle();
  if (!show) return { error: "Show not found." };

  let displayName = d.displayName?.trim() ?? "";
  if (d.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", d.userId)
      .maybeSingle();
    if (!profile) return { error: "Selected member not found." };
    displayName = profile.full_name || profile.email;
  }

  const { data: inserted, error } = await supabase
    .from("show_staff")
    .insert({
      show_id: d.showId,
      organization_id: show.organization_id,
      user_id: d.userId || null,
      display_name: displayName,
      staff_role: d.staffRole,
      notes: d.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("show_staff_user_role_unique")) {
      return { error: "That member already holds this staff role on this show." };
    }
    return { error: error.message };
  }

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "show.staff_added",
    p_entity_type: "show_staff",
    p_entity_id: inserted?.id ?? null,
    p_old: null,
    p_new: { show_id: d.showId, name: displayName, role: d.staffRole },
  });

  revalidatePath(`/shows/${d.showId}/staff`);
  return {};
}

export async function removeStaff(
  showId: string,
  staffId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("show_staff")
    .select("organization_id, display_name, staff_role")
    .eq("id", staffId)
    .maybeSingle();
  if (!staff) return { error: "Staff assignment not found." };

  const { data: deleted, error } = await supabase
    .from("show_staff")
    .delete()
    .eq("id", staffId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Remove was not applied. It requires the show.edit permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: staff.organization_id,
    p_action: "show.staff_removed",
    p_entity_type: "show_staff",
    p_entity_id: staffId,
    p_old: { name: staff.display_name, role: staff.staff_role },
    p_new: null,
  });

  revalidatePath(`/shows/${showId}/staff`);
  return {};
}
