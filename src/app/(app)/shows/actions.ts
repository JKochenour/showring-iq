"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import {
  addStaffSchema,
  createShowSchema,
  updateShowSchema,
  updateStandardChargesSchema,
  updateScheduleSettingsSchema,
  updateEventClassificationSchema,
  updateConditionalFeesSchema,
  type AddStaffInput,
  type CreateShowInput,
  type UpdateShowInput,
  type UpdateStandardChargesInput,
  type UpdateScheduleSettingsInput,
  type UpdateEventClassificationInput,
  type UpdateConditionalFeesInput,
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
    .select("organization_id, name, slug, start_date, end_date, timezone, venue_name, city, state, contact_name, contact_email, contact_phone, description, nrha_show_number, medication_fee_cents")
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
    medication_fee_cents: dollarsToCents(d.medicationFee ?? ""),
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
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}`, "layout");
  return {};
}

export async function updateStandardCharges(
  input: UpdateStandardChargesInput
): Promise<ActionResult> {
  const parsed = updateStandardChargesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before, error: beforeError } = await supabase
    .from("shows")
    .select("organization_id, standard_entry_charges")
    .eq("id", d.showId)
    .maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Show not found." };

  const charges = d.charges
    .filter((c) => c.label.trim() !== "" && c.amount.trim() !== "")
    .map((c) => ({
      label: c.label.trim(),
      amount_cents: dollarsToCents(c.amount),
      per_run: c.perRun,
    }));

  const { data: updated, error } = await supabase
    .from("shows")
    .update({ standard_entry_charges: charges })
    .eq("id", d.showId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the show.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: before.organization_id,
    p_action: "show.standard_charges_updated",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: { standard_entry_charges: before.standard_entry_charges },
    p_new: { standard_entry_charges: charges },
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}/settings`);
  return {};
}

export async function updateConditionalFees(
  input: UpdateConditionalFeesInput
): Promise<ActionResult> {
  const parsed = updateConditionalFeesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before, error: beforeError } = await supabase
    .from("shows")
    .select(
      "organization_id, late_entry_fee_cents, close_out_fee_cents, close_out_deadline, card_surcharge_percent"
    )
    .eq("id", d.showId)
    .maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Show not found." };

  const updates = {
    late_entry_fee_cents: d.lateEntryFee.trim() ? dollarsToCents(d.lateEntryFee) : 0,
    close_out_fee_cents: d.closeOutFee.trim() ? dollarsToCents(d.closeOutFee) : 0,
    close_out_deadline: d.closeOutDeadline?.trim() ? d.closeOutDeadline : null,
    card_surcharge_percent: d.cardSurchargePercent,
  };

  const { data: updated, error } = await supabase
    .from("shows")
    .update(updates)
    .eq("id", d.showId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the show.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: before.organization_id,
    p_action: "show.conditional_fees_updated",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: before,
    p_new: updates,
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}/settings`);
  return {};
}

export async function applyCloseOutFee(
  showId: string
): Promise<ActionResult & { applied?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_close_out_fee", {
    p_show: showId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${showId}/financials`);
  return { applied: data as number };
}

export async function updateEventClassification(
  input: UpdateEventClassificationInput
): Promise<ActionResult> {
  const parsed = updateEventClassificationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before, error: beforeError } = await supabase
    .from("shows")
    .select("organization_id, event_classification")
    .eq("id", d.showId)
    .maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Show not found." };

  const { data: updated, error } = await supabase
    .from("shows")
    .update({ event_classification: d.classification })
    .eq("id", d.showId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the show.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: before.organization_id,
    p_action: "show.classification_updated",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: { event_classification: before.event_classification },
    p_new: { event_classification: d.classification },
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}/staff`);
  return {};
}

export async function updateScheduleSettings(
  input: UpdateScheduleSettingsInput
): Promise<ActionResult> {
  const parsed = updateScheduleSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before, error: beforeError } = await supabase
    .from("shows")
    .select(
      "organization_id, schedule_start_time, schedule_break_minutes, schedule_drag_minutes"
    )
    .eq("id", d.showId)
    .maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Show not found." };

  const updates = {
    schedule_start_time: `${d.startTime}:00`,
    schedule_break_minutes: d.breakMinutes,
    schedule_drag_minutes: d.dragMinutes,
  };

  const { data: updated, error } = await supabase
    .from("shows")
    .update(updates)
    .eq("id", d.showId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the show.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: before.organization_id,
    p_action: "show.schedule_settings_updated",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: {
      schedule_start_time: before.schedule_start_time,
      schedule_break_minutes: before.schedule_break_minutes,
      schedule_drag_minutes: before.schedule_drag_minutes,
    },
    p_new: updates,
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}/settings`);
  revalidatePath(`/shows/${d.showId}/schedule`);
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
    p_show: showId,
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
    p_show: d.showId,
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
    .select("organization_id, display_name, staff_role, show_id")
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
    p_show: staff.show_id,
  });

  revalidatePath(`/shows/${showId}/staff`);
  return {};
}
