"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import {
  createClassSchema,
  updateClassSchema,
  addClassAffiliationSchema,
  updateClassAffiliationSchema,
  importBillClassesSchema,
  type CreateClassInput,
  type UpdateClassInput,
  type AddClassAffiliationInput,
  type UpdateClassAffiliationInput,
  type ImportBillClassesInput,
} from "@/lib/validation/class";
import { extractPdfText } from "@/lib/import/pdf-text";
import {
  setClassPatternSchema,
  type SetClassPatternInput,
} from "@/lib/validation/class-pattern";

export type ActionResult = { error?: string };

export async function createClass(
  input: CreateClassInput
): Promise<ActionResult> {
  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: show, error: showError } = await supabase
    .from("shows")
    .select("organization_id")
    .eq("id", d.showId)
    .maybeSingle();
  if (showError) return { error: showError.message };
  if (!show) return { error: "Show not found." };

  // RLS enforces class.create and an unlocked show
  const { data: created, error } = await supabase
    .from("classes")
    .insert({
      show_id: d.showId,
      organization_id: show.organization_id,
      class_number: d.classNumber,
      name: d.name,
      discipline: d.discipline || null,
      division: d.division || null,
      pattern_number: d.patternNumber ?? null,
      drag_every_n: d.dragEveryN ?? null,
      avg_run_minutes: parseFloat(d.avgRunMinutes),
      is_youth: d.isYouth,
      is_single_purse: d.isSinglePurse,
      nrha_class_code: d.nrhaClassCode || null,
      class_code_id: d.classCodeId || null,
      entry_fee_cents: dollarsToCents(d.entryFee ?? ""),
      added_money_cents: dollarsToCents(d.addedMoney ?? ""),
      scheduled_date: d.scheduledDate || null,
      notes: d.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("classes_show_id_class_number_key")) {
      return { error: `Class number ${d.classNumber} is already used in this show.` };
    }
    if (error.message.includes("does not belong to this organization")) {
      return { error: "That class code doesn't belong to this organization." };
    }
    return { error: error.message };
  }
  if (!created) {
    return {
      error:
        "Class was not created. You may lack the class.create permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "class.created",
    p_entity_type: "class",
    p_entity_id: created.id,
    p_old: null,
    p_new: { show_id: d.showId, class_number: d.classNumber, name: d.name },
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}/classes`);
  redirect(`/shows/${d.showId}/classes`);
}

/** Extracts the text layer of an uploaded show-bill PDF so the client can
 * run the parser on it. Read-only — nothing is created here. */
export async function extractShowBillText(
  formData: FormData
): Promise<{ text?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a PDF file." };
  if (file.size > 20 * 1024 * 1024) return { error: "PDF is too large (20 MB max)." };

  try {
    const text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    if (!text.trim()) {
      return {
        error:
          "No text layer found — this looks like a scanned image. Paste the class schedule text instead.",
      };
    }
    return { text };
  } catch (err) {
    return {
      error: `Couldn't read that PDF: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Bulk-creates classes reviewed in the show-bill import preview.
 * Class numbers continue from the show's current highest; RLS enforces
 * class.create and an unlocked show on every row. */
export async function importBillClasses(
  input: ImportBillClassesInput
): Promise<{ created?: number; error?: string }> {
  const parsed = importBillClassesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: show, error: showError } = await supabase
    .from("shows")
    .select("organization_id")
    .eq("id", d.showId)
    .maybeSingle();
  if (showError) return { error: showError.message };
  if (!show) return { error: "Show not found." };

  const { data: maxRow } = await supabase
    .from("classes")
    .select("class_number")
    .eq("show_id", d.showId)
    .order("class_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (maxRow?.class_number ?? 0) + 1;

  const rows = d.classes.map((c, i) => ({
    show_id: d.showId,
    organization_id: show.organization_id,
    class_number: base + i,
    name: c.name,
    pattern_number: c.patternNumber ?? null,
    is_youth: c.isYouth,
    entry_fee_cents: dollarsToCents(c.entryFee ?? ""),
    added_money_cents: dollarsToCents(c.addedMoney ?? ""),
    scheduled_date: c.scheduledDate || null,
    notes: c.notes || null,
  }));

  const { data: created, error } = await supabase
    .from("classes")
    .insert(rows)
    .select("id");

  if (error) return { error: error.message };
  if (!created || created.length === 0) {
    return {
      error:
        "No classes were created. You may lack the class.create permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "class.bill_imported",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: null,
    p_new: {
      count: created.length,
      class_numbers: `${base}-${base + created.length - 1}`,
    },
    p_show: d.showId,
  });

  revalidatePath(`/shows/${d.showId}/classes`);
  revalidatePath(`/shows/${d.showId}/schedule`);
  return { created: created.length };
}

export async function updateClass(
  input: UpdateClassInput
): Promise<ActionResult> {
  const parsed = updateClassSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before, error: beforeError } = await supabase
    .from("classes")
    .select(
      "show_id, organization_id, class_number, name, discipline, division, pattern_number, entry_fee_cents, added_money_cents, status, scheduled_date, notes"
    )
    .eq("id", d.classId)
    .maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Class not found." };

  const updates = {
    class_number: d.classNumber,
    name: d.name,
    discipline: d.discipline || null,
    division: d.division || null,
    pattern_number: d.patternNumber ?? null,
    drag_every_n: d.dragEveryN ?? null,
    avg_run_minutes: parseFloat(d.avgRunMinutes),
    is_youth: d.isYouth,
    nrha_class_code: d.nrhaClassCode || null,
    class_code_id: d.classCodeId || null,
    entry_fee_cents: dollarsToCents(d.entryFee ?? ""),
    added_money_cents: dollarsToCents(d.addedMoney ?? ""),
    status: d.status,
    scheduled_date: d.scheduledDate || null,
    notes: d.notes || null,
  };

  const { data: updated, error } = await supabase
    .from("classes")
    .update(updates)
    .eq("id", d.classId)
    .select("id");

  if (error) {
    if (error.message.includes("classes_show_id_class_number_key")) {
      return { error: `Class number ${d.classNumber} is already used in this show.` };
    }
    if (error.message.includes("does not belong to this organization")) {
      return { error: "That class code doesn't belong to this organization." };
    }
    return { error: error.message };
  }
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the class.edit permission, or the show is locked/archived.",
    };
  }

  const { show_id, organization_id, ...beforeValues } = before;
  await supabase.rpc("log_audit", {
    p_org: organization_id,
    p_action: "class.updated",
    p_entity_type: "class",
    p_entity_id: d.classId,
    p_old: beforeValues,
    p_new: updates,
    p_show: show_id,
  });

  revalidatePath(`/shows/${show_id}/classes`, "layout");
  return {};
}

export async function deleteClass(
  classId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("show_id, organization_id, class_number, name")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const { data: deleted, error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId)
    .select("id");

  if (error) {
    if (error.message.includes("violates foreign key constraint")) {
      return {
        error:
          "This class has entries and can't be deleted. Cancel the class instead.",
      };
    }
    return { error: error.message };
  }
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Delete was not applied. It requires the class.delete permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.deleted",
    p_entity_type: "class",
    p_entity_id: classId,
    p_old: { class_number: cls.class_number, name: cls.name },
    p_new: null,
    p_show: cls.show_id,
  });

  revalidatePath(`/shows/${cls.show_id}/classes`);
  redirect(`/shows/${cls.show_id}/classes`);
}

/** Cancels a class regardless of its current workflow stage. The edit
 * form only exposes the status dropdown for early-stage classes (draft/
 * open/entry_closed) since later stages are workflow-driven — but once
 * entries exist, deleteClass is blocked by the entries FK and its own
 * error message says "cancel the class instead," which the status
 * dropdown can no longer do. This is the dedicated escape hatch: same
 * "cancelled" status set by updateClass, reachable from any status. */
export async function cancelClass(classId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("show_id, organization_id, class_number, name, status")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };
  if (cls.status === "cancelled") return {};

  const { data: updated, error } = await supabase
    .from("classes")
    .update({ status: "cancelled" })
    .eq("id", classId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Cancel was not applied. You may lack the class.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.cancelled",
    p_entity_type: "class",
    p_entity_id: classId,
    p_old: { status: cls.status },
    p_new: { status: "cancelled" },
    p_show: cls.show_id,
  });

  revalidatePath(`/shows/${cls.show_id}/classes`, "layout");
  return {};
}

export async function setClassPattern(
  input: SetClassPatternInput
): Promise<ActionResult> {
  const parsed = setClassPatternSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("show_id, organization_id, class_number")
    .eq("id", d.classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const { data: existing } = await supabase
    .from("class_patterns")
    .select("id")
    .eq("class_id", d.classId)
    .maybeSingle();

  const values = {
    class_id: d.classId,
    pattern_text: d.patternText?.trim() || null,
    pattern_key: d.patternKey || null,
    document_id: d.documentId || null,
  };

  const { data: saved, error } = existing
    ? await supabase
        .from("class_patterns")
        .update(values)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("class_patterns")
        .insert(values)
        .select("id")
        .maybeSingle();

  if (error) return { error: error.message };
  if (!saved) {
    return {
      error:
        "Pattern was not saved. It requires the class.edit permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.pattern_updated",
    p_entity_type: "class",
    p_entity_id: d.classId,
    p_old: null,
    p_new: {
      class_number: cls.class_number,
      has_text: !!values.pattern_text,
      has_document: !!values.document_id,
    },
  });

  revalidatePath(`/shows/${cls.show_id}/classes/${d.classId}`);
  revalidatePath(`/shows/${cls.show_id}/scoring/${d.classId}`);
  return {};
}

export async function deleteClassPattern(classId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("show_id, organization_id, class_number")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const { data: deleted, error } = await supabase
    .from("class_patterns")
    .delete()
    .eq("class_id", classId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Remove was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.pattern_updated",
    p_entity_type: "class",
    p_entity_id: classId,
    p_old: { class_number: cls.class_number },
    p_new: null,
  });

  revalidatePath(`/shows/${cls.show_id}/classes/${classId}`);
  revalidatePath(`/shows/${cls.show_id}/scoring/${classId}`);
  return {};
}

export async function assignClassJudge(
  classId: string,
  showStaffId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("show_id, organization_id, class_number, name")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const { data: staff } = await supabase
    .from("show_staff")
    .select("display_name, staff_role")
    .eq("id", showStaffId)
    .maybeSingle();
  if (!staff) return { error: "Judge not found." };

  const { data: inserted, error } = await supabase
    .from("class_judges")
    .insert({ class_id: classId, show_staff_id: showStaffId })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("class_judges_class_id_show_staff_id_key")) {
      return { error: "This judge is already assigned to this class." };
    }
    return { error: error.message };
  }
  if (!inserted) {
    return {
      error:
        "Assignment was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.judge_assigned",
    p_entity_type: "class",
    p_entity_id: classId,
    p_old: null,
    p_new: { class_number: cls.class_number, judge: staff.display_name },
    p_show: cls.show_id,
  });

  revalidatePath(`/shows/${cls.show_id}/classes/${classId}`);
  revalidatePath(`/shows/${cls.show_id}/scoring`);
  return {};
}

export async function unassignClassJudge(
  classJudgeId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("class_judges")
    .select(
      "class_id, show_id, organization_id, show_staff:show_staff(display_name), class:classes(class_number)"
    )
    .eq("id", classJudgeId)
    .maybeSingle();
  if (!assignment) return { error: "Assignment not found." };

  const staffName = (
    assignment.show_staff as unknown as { display_name: string } | null
  )?.display_name;
  const classNumber = (
    assignment.class as unknown as { class_number: number } | null
  )?.class_number;

  const { data: deleted, error } = await supabase
    .from("class_judges")
    .delete()
    .eq("id", classJudgeId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Remove was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: assignment.organization_id,
    p_action: "class.judge_unassigned",
    p_entity_type: "class",
    p_entity_id: assignment.class_id,
    p_old: { class_number: classNumber, judge: staffName },
    p_new: null,
    p_show: assignment.show_id,
  });

  revalidatePath(`/shows/${assignment.show_id}/classes/${assignment.class_id}`);
  revalidatePath(`/shows/${assignment.show_id}/scoring`);
  return {};
}

/** Adds a class_affiliations row (one association/rule-package code
 * for a class). When marked primary, clears any other primary row
 * for the class and syncs classes.class_code_id so legacy single-code
 * reads keep working. */
export async function addClassAffiliation(
  input: AddClassAffiliationInput
): Promise<ActionResult> {
  const parsed = addClassAffiliationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("show_id, organization_id, class_number, name")
    .eq("id", d.classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  if (d.isPrimary) {
    await supabase
      .from("class_affiliations")
      .update({ is_primary: false })
      .eq("class_id", d.classId);
  }

  const { data: inserted, error } = await supabase
    .from("class_affiliations")
    .insert({
      class_id: d.classId,
      association_class_code_id: d.associationClassCodeId,
      counts_for_money: d.countsForMoney,
      counts_for_points: d.countsForPoints,
      counts_for_year_end: d.countsForYearEnd,
      is_primary: d.isPrimary,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("class_affiliations_class_id_association_class_code_id_key")) {
      return { error: "This class code is already linked to this class." };
    }
    if (error.message.includes("does not belong to this organization")) {
      return { error: "That class code doesn't belong to this organization." };
    }
    return { error: error.message };
  }
  if (!inserted) {
    return {
      error:
        "Affiliation was not added. You may lack the class.edit permission, or the show is locked/archived.",
    };
  }

  if (d.isPrimary) {
    await supabase
      .from("classes")
      .update({ class_code_id: d.associationClassCodeId })
      .eq("id", d.classId);
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.affiliation_added",
    p_entity_type: "class",
    p_entity_id: d.classId,
    p_old: null,
    p_new: {
      class_number: cls.class_number,
      association_class_code_id: d.associationClassCodeId,
      counts_for_money: d.countsForMoney,
      counts_for_points: d.countsForPoints,
      counts_for_year_end: d.countsForYearEnd,
      is_primary: d.isPrimary,
    },
  });

  revalidatePath(`/shows/${cls.show_id}/classes/${d.classId}`);
  return {};
}

export async function updateClassAffiliation(
  input: UpdateClassAffiliationInput
): Promise<ActionResult> {
  const parsed = updateClassAffiliationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("class_affiliations")
    .select(
      "class_id, show_id, organization_id, association_class_code_id, counts_for_money, counts_for_points, counts_for_year_end, is_primary, class:classes(class_number)"
    )
    .eq("id", d.classAffiliationId)
    .maybeSingle();
  if (!before) return { error: "Affiliation not found." };

  if (d.isPrimary && !before.is_primary) {
    await supabase
      .from("class_affiliations")
      .update({ is_primary: false })
      .eq("class_id", before.class_id);
  }

  const { data: updated, error } = await supabase
    .from("class_affiliations")
    .update({
      counts_for_money: d.countsForMoney,
      counts_for_points: d.countsForPoints,
      counts_for_year_end: d.countsForYearEnd,
      is_primary: d.isPrimary,
    })
    .eq("id", d.classAffiliationId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  if (d.isPrimary) {
    await supabase
      .from("classes")
      .update({ class_code_id: before.association_class_code_id })
      .eq("id", before.class_id);
  } else if (before.is_primary) {
    // Was primary, no longer is — clear the legacy pointer if it
    // still points at this affiliation's code (don't clobber a value
    // someone else changed concurrently).
    await supabase
      .from("classes")
      .update({ class_code_id: null })
      .eq("id", before.class_id)
      .eq("class_code_id", before.association_class_code_id);
  }

  const className = (before.class as unknown as { class_number: number } | null)?.class_number;
  await supabase.rpc("log_audit", {
    p_org: before.organization_id,
    p_action: "class.affiliation_updated",
    p_entity_type: "class",
    p_entity_id: before.class_id,
    p_old: {
      class_number: className,
      counts_for_money: before.counts_for_money,
      counts_for_points: before.counts_for_points,
      counts_for_year_end: before.counts_for_year_end,
      is_primary: before.is_primary,
    },
    p_new: {
      counts_for_money: d.countsForMoney,
      counts_for_points: d.countsForPoints,
      counts_for_year_end: d.countsForYearEnd,
      is_primary: d.isPrimary,
    },
  });

  revalidatePath(`/shows/${before.show_id}/classes/${before.class_id}`);
  return {};
}

export async function removeClassAffiliation(
  classAffiliationId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: aff } = await supabase
    .from("class_affiliations")
    .select(
      "class_id, show_id, organization_id, association_class_code_id, is_primary, class:classes(class_number)"
    )
    .eq("id", classAffiliationId)
    .maybeSingle();
  if (!aff) return { error: "Affiliation not found." };

  const { data: deleted, error } = await supabase
    .from("class_affiliations")
    .delete()
    .eq("id", classAffiliationId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Remove was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  if (aff.is_primary) {
    await supabase
      .from("classes")
      .update({ class_code_id: null })
      .eq("id", aff.class_id)
      .eq("class_code_id", aff.association_class_code_id);
  }

  const className = (aff.class as unknown as { class_number: number } | null)?.class_number;
  await supabase.rpc("log_audit", {
    p_org: aff.organization_id,
    p_action: "class.affiliation_removed",
    p_entity_type: "class",
    p_entity_id: aff.class_id,
    p_old: { class_number: className, association_class_code_id: aff.association_class_code_id },
    p_new: null,
  });

  revalidatePath(`/shows/${aff.show_id}/classes/${aff.class_id}`);
  return {};
}

export async function moveClass(
  classId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, show_id, organization_id, display_order, class_number")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const { data: neighbor } = await supabase
    .from("classes")
    .select("id, display_order, class_number")
    .eq("show_id", cls.show_id)
    .order("display_order", { ascending: direction === "down" })
    .filter(
      "display_order",
      direction === "up" ? "lt" : "gt",
      cls.display_order
    )
    .limit(1)
    .maybeSingle();

  if (!neighbor) return {}; // already at the edge

  const [{ data: a, error: errA }, { data: b, error: errB }] =
    await Promise.all([
      supabase
        .from("classes")
        .update({ display_order: neighbor.display_order })
        .eq("id", cls.id)
        .select("id"),
      supabase
        .from("classes")
        .update({ display_order: cls.display_order })
        .eq("id", neighbor.id)
        .select("id"),
    ]);

  if (errA || errB) return { error: (errA ?? errB)!.message };
  if (!a?.length || !b?.length) {
    return {
      error:
        "Reorder was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.reordered",
    p_entity_type: "class",
    p_entity_id: cls.id,
    p_old: { position: cls.display_order },
    p_new: { position: neighbor.display_order, swapped_with_class: neighbor.class_number },
    p_show: cls.show_id,
  });

  revalidatePath(`/shows/${cls.show_id}/classes`);
  return {};
}

/** Links/unlinks classId with concurrentWithClassIds (all in the same
 * show) as one "runs concurrent" group — a single shared_run_id per
 * physical run across every grouped class's draw. Merges any
 * pre-existing groups the touched classes already belonged to, so a
 * class already grouped with others doesn't get silently orphaned.
 * An empty concurrentWithClassIds removes classId from its group (and
 * dissolves the group entirely if only one class would remain in it). */
export async function updateClassConcurrency(
  classId: string,
  concurrentWithClassIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls, error: clsError } = await supabase
    .from("classes")
    .select("id, show_id, organization_id, class_number, concurrent_group_id")
    .eq("id", classId)
    .maybeSingle();
  if (clsError) return { error: clsError.message };
  if (!cls) return { error: "Class not found." };

  if (concurrentWithClassIds.length === 0) {
    if (!cls.concurrent_group_id) return {};

    const { error: clearError } = await supabase
      .from("classes")
      .update({ concurrent_group_id: null })
      .eq("id", classId);
    if (clearError) return { error: clearError.message };

    const { data: remaining } = await supabase
      .from("classes")
      .select("id")
      .eq("concurrent_group_id", cls.concurrent_group_id);
    if (remaining && remaining.length === 1) {
      await supabase
        .from("classes")
        .update({ concurrent_group_id: null })
        .eq("id", remaining[0].id);
    }

    await supabase.rpc("log_audit", {
      p_org: cls.organization_id,
      p_action: "class.concurrency_updated",
      p_entity_type: "class",
      p_entity_id: classId,
      p_old: { concurrent_group_id: cls.concurrent_group_id },
      p_new: { concurrent_group_id: null },
      p_show: cls.show_id,
    });

    revalidatePath(`/shows/${cls.show_id}/classes/${classId}`);
    revalidatePath(`/shows/${cls.show_id}/classes`);
    return {};
  }

  const { data: targets, error: targetsError } = await supabase
    .from("classes")
    .select("id, show_id, class_number, concurrent_group_id")
    .in("id", concurrentWithClassIds);
  if (targetsError) return { error: targetsError.message };
  if (!targets || targets.length !== concurrentWithClassIds.length) {
    return { error: "One or more selected classes were not found." };
  }
  if (targets.some((t) => t.show_id !== cls.show_id)) {
    return {
      error: "Classes can only run concurrent with other classes in the same show.",
    };
  }

  const touchedGroupIds = [
    cls.concurrent_group_id,
    ...targets.map((t) => t.concurrent_group_id),
  ].filter((g): g is string => !!g);
  const groupId = touchedGroupIds[0] ?? crypto.randomUUID();

  const allAffectedIds = new Set<string>([classId, ...concurrentWithClassIds]);
  if (touchedGroupIds.length > 0) {
    const { data: groupMembers } = await supabase
      .from("classes")
      .select("id")
      .in("concurrent_group_id", touchedGroupIds);
    for (const m of groupMembers ?? []) allAffectedIds.add(m.id as string);
  }

  const { error: updateError } = await supabase
    .from("classes")
    .update({ concurrent_group_id: groupId })
    .in("id", [...allAffectedIds]);
  if (updateError) return { error: updateError.message };

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: "class.concurrency_updated",
    p_entity_type: "class",
    p_entity_id: classId,
    p_old: null,
    p_new: {
      class_number: cls.class_number,
      runs_concurrent_with: targets.map((t) => t.class_number),
    },
    p_show: cls.show_id,
  });

  revalidatePath(`/shows/${cls.show_id}/classes/${classId}`);
  revalidatePath(`/shows/${cls.show_id}/classes`);
  return {};
}
