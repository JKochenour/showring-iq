"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import {
  createClassSchema,
  updateClassSchema,
  type CreateClassInput,
  type UpdateClassInput,
} from "@/lib/validation/class";

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

  const { data: show } = await supabase
    .from("shows")
    .select("organization_id")
    .eq("id", d.showId)
    .maybeSingle();
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
  });

  revalidatePath(`/shows/${d.showId}/classes`);
  redirect(`/shows/${d.showId}/classes`);
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

  const { data: before } = await supabase
    .from("classes")
    .select(
      "show_id, organization_id, class_number, name, discipline, division, pattern_number, entry_fee_cents, added_money_cents, status, scheduled_date, notes"
    )
    .eq("id", d.classId)
    .maybeSingle();
  if (!before) return { error: "Class not found." };

  const updates = {
    class_number: d.classNumber,
    name: d.name,
    discipline: d.discipline || null,
    division: d.division || null,
    pattern_number: d.patternNumber ?? null,
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

  if (error) return { error: error.message };
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
  });

  revalidatePath(`/shows/${cls.show_id}/classes`);
  redirect(`/shows/${cls.show_id}/classes`);
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
  });

  revalidatePath(`/shows/${cls.show_id}/classes`);
  return {};
}
