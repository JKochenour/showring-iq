"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDrawOrder, randomSeed } from "@/lib/draw";

export type ActionResult = { error?: string };

function revalidateDrawPages(showId: string, classId?: string) {
  revalidatePath(`/shows/${showId}/draws`);
  if (classId) revalidatePath(`/shows/${showId}/draws/${classId}`);
  revalidatePath(`/shows/${showId}/gate`);
  revalidatePath(`/shows/${showId}/announcer`);
}

export async function generateDraw(
  classId: string,
  seedInput?: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, show_id, organization_id, class_number, status")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const { data: entryClasses } = await supabase
    .from("entry_classes")
    .select("id, status, entry:entries(id, rider_person_id, status)")
    .eq("class_id", classId)
    .eq("status", "entered");

  const candidates =
    entryClasses
      ?.map((ec) => ({
        entryClassId: ec.id as string,
        entry: ec.entry as unknown as {
          id: string;
          rider_person_id: string;
          status: string;
        } | null,
      }))
      .filter((ec) => ec.entry && ec.entry.status === "active")
      .map((ec) => ({
        entryClassId: ec.entryClassId,
        riderPersonId: ec.entry!.rider_person_id,
      })) ?? [];

  if (candidates.length === 0) {
    return { error: "No active entered entries in this class to draw." };
  }

  const { count: existingCount } = await supabase
    .from("class_draws")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  const isRedraw = (existingCount ?? 0) > 0;

  if (isRedraw) {
    const { error: deleteError } = await supabase
      .from("class_draws")
      .delete()
      .eq("class_id", classId);
    if (deleteError) return { error: deleteError.message };
  }

  const seed = seedInput?.trim() || randomSeed();
  const order = generateDrawOrder(candidates, seed);

  const { error: insertError } = await supabase.from("class_draws").insert(
    order.map((candidate, index) => ({
      class_id: classId,
      entry_class_id: candidate.entryClassId,
      position: index + 1,
    }))
  );

  if (insertError) {
    return {
      error: insertError.message.includes("row-level security")
        ? "Draw was not created. It requires the class.schedule permission on an unlocked show."
        : insertError.message,
    };
  }

  await supabase.rpc("log_audit", {
    p_org: cls.organization_id,
    p_action: isRedraw ? "draw.regenerated" : "draw.generated",
    p_entity_type: "class",
    p_entity_id: classId,
    p_old: isRedraw ? { previous_rows: existingCount } : null,
    p_new: {
      class_number: cls.class_number,
      seed,
      runs: order.length,
      rider_spacing: 1,
    },
    p_reason: isRedraw ? "Re-draw" : null,
    p_show: cls.show_id,
  });

  // Best effort: advance class status to draw_posted (needs class.edit)
  if (["draft", "open", "entry_closed"].includes(cls.status)) {
    await supabase
      .from("classes")
      .update({ status: "draw_posted" })
      .eq("id", classId);
  }

  revalidateDrawPages(cls.show_id, classId);
  return {};
}

export async function appendToDraw(
  entryClassId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: ec } = await supabase
    .from("entry_classes")
    .select("id, class_id, show_id, organization_id, status")
    .eq("id", entryClassId)
    .maybeSingle();
  if (!ec) return { error: "Entry class not found." };
  if (ec.status !== "entered") {
    return { error: "Only entered (non-scratched) entries can join the draw." };
  }

  const { data: maxRow } = await supabase
    .from("class_draws")
    .select("position")
    .eq("class_id", ec.class_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("class_draws")
    .insert({
      class_id: ec.class_id,
      entry_class_id: entryClassId,
      position: (maxRow?.position ?? 0) + 1,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("class_draws_class_id_entry_class_id_key")) {
      return { error: "This entry is already in the draw." };
    }
    return { error: error.message };
  }
  if (!created) {
    return {
      error:
        "Entry was not added. It requires the class.schedule permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: ec.organization_id,
    p_action: "draw.late_entry_appended",
    p_entity_type: "class_draw",
    p_entity_id: created.id,
    p_old: null,
    p_new: { class_id: ec.class_id, position: (maxRow?.position ?? 0) + 1 },
    p_show: ec.show_id,
  });

  revalidateDrawPages(ec.show_id, ec.class_id);
  return {};
}

export async function moveDrawRow(
  rowId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("class_draws")
    .select("show_id, class_id")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return { error: "Draw row not found." };

  const { error } = await supabase.rpc("move_draw_row", {
    p_row: rowId,
    p_direction: direction,
  });
  if (error) return { error: error.message };

  revalidateDrawPages(row.show_id, row.class_id);
  return {};
}

export async function setRunStatus(
  rowId: string,
  status: string,
  reason?: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("class_draws")
    .select("show_id, class_id")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return { error: "Draw row not found." };

  const { error } = await supabase.rpc("set_run_status", {
    p_row: rowId,
    p_status: status,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidateDrawPages(row.show_id, row.class_id);
  return {};
}

export async function removeFromDraw(rowId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("class_draws")
    .select("show_id, class_id, organization_id, position")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return { error: "Draw row not found." };

  const { data: deleted, error } = await supabase
    .from("class_draws")
    .delete()
    .eq("id", rowId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Remove was not applied. It requires the class.schedule permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: row.organization_id,
    p_action: "draw.row_removed",
    p_entity_type: "class_draw",
    p_entity_id: rowId,
    p_old: { class_id: row.class_id, position: row.position },
    p_new: null,
    p_show: row.show_id,
  });

  revalidateDrawPages(row.show_id, row.class_id);
  return {};
}
