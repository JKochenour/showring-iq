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

/** entry_classes rows sharing an entry_id all represent the same
 * physical run when their classes run concurrently — one draw pass
 * over the distinct entries produces every class's rows at once. */
async function classesInGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  concurrentGroupId: string | null
): Promise<string[]> {
  if (!concurrentGroupId) return [classId];
  const { data } = await supabase
    .from("classes")
    .select("id")
    .eq("concurrent_group_id", concurrentGroupId);
  const ids = (data ?? []).map((c) => c.id as string);
  return ids.length > 0 ? ids : [classId];
}

export async function generateDraw(
  classId: string,
  seedInput?: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, show_id, organization_id, class_number, status, concurrent_group_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: "Class not found." };

  const groupClassIds = await classesInGroup(
    supabase,
    classId,
    cls.concurrent_group_id
  );

  const { data: entryClasses } = await supabase
    .from("entry_classes")
    .select("id, class_id, status, entry:entries(id, rider_person_id, status)")
    .in("class_id", groupClassIds)
    .eq("status", "entered");

  type EC = {
    id: string;
    class_id: string;
    entry: { id: string; rider_person_id: string; status: string } | null;
  };
  const activeECs = ((entryClasses as unknown as EC[]) ?? []).filter(
    (ec) => ec.entry && ec.entry.status === "active"
  );

  if (activeECs.length === 0) {
    return { error: "No active entered entries in this class to draw." };
  }

  // One run per distinct entry across the whole group — an entry
  // entered in two grouped classes runs once, appearing in both.
  const byEntry = new Map<string, EC[]>();
  for (const ec of activeECs) {
    const entryId = ec.entry!.id;
    const list = byEntry.get(entryId) ?? [];
    list.push(ec);
    byEntry.set(entryId, list);
  }

  const candidates = [...byEntry.values()].map((ecs) => ({
    entryClassId: ecs[0].id,
    riderPersonId: ecs[0].entry!.rider_person_id,
  }));
  const ecsByRepresentative = new Map(
    [...byEntry.values()].map((ecs) => [ecs[0].id, ecs])
  );

  const { count: existingCount } = await supabase
    .from("class_draws")
    .select("id", { count: "exact", head: true })
    .in("class_id", groupClassIds);
  const isRedraw = (existingCount ?? 0) > 0;

  if (isRedraw) {
    const { error: deleteError } = await supabase
      .from("class_draws")
      .delete()
      .in("class_id", groupClassIds);
    if (deleteError) return { error: deleteError.message };
  }

  const seed = seedInput?.trim() || randomSeed();
  const order = generateDrawOrder(candidates, seed);

  const rows: {
    class_id: string;
    entry_class_id: string;
    position: number;
    shared_run_id: string;
  }[] = [];
  order.forEach((candidate, index) => {
    const sharedRunId = crypto.randomUUID();
    const ecs = ecsByRepresentative.get(candidate.entryClassId) ?? [];
    for (const ec of ecs) {
      rows.push({
        class_id: ec.class_id,
        entry_class_id: ec.id,
        position: index + 1,
        shared_run_id: sharedRunId,
      });
    }
  });

  const { error: insertError } = await supabase.from("class_draws").insert(rows);

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
      concurrent_classes: groupClassIds.length > 1 ? groupClassIds.length : undefined,
    },
    p_reason: isRedraw ? "Re-draw" : null,
    p_show: cls.show_id,
  });

  // Best effort: advance to draw_posted only the classes that actually
  // received draw rows. A concurrent group can contain classes nobody
  // entered — posting a draw for a sibling must not drag those into the
  // workflow-locked draw_posted state with zero entries.
  const drawnClassIds = [...new Set(rows.map((r) => r.class_id))];
  await supabase
    .from("classes")
    .update({ status: "draw_posted" })
    .in("id", drawnClassIds)
    .in("status", ["draft", "open", "entry_closed"]);

  for (const id of groupClassIds) revalidateDrawPages(cls.show_id, id);
  return {};
}

export async function appendToDraw(
  entryClassId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: ec } = await supabase
    .from("entry_classes")
    .select("id, class_id, entry_id, show_id, organization_id, status")
    .eq("id", entryClassId)
    .maybeSingle();
  if (!ec) return { error: "Entry class not found." };
  if (ec.status !== "entered") {
    return { error: "Only entered (non-scratched) entries can join the draw." };
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("concurrent_group_id")
    .eq("id", ec.class_id)
    .maybeSingle();
  const groupClassIds = await classesInGroup(
    supabase,
    ec.class_id,
    cls?.concurrent_group_id ?? null
  );

  // If this entry already has a run in a sibling grouped class (same
  // physical horse/rider), join that run instead of creating a new one.
  let sharedRunId: string | null = null;
  let position: number | null = null;
  if (groupClassIds.length > 1) {
    const { data: siblingECs } = await supabase
      .from("entry_classes")
      .select("id")
      .eq("entry_id", ec.entry_id)
      .in("class_id", groupClassIds);
    const siblingIds = (siblingECs ?? []).map((s) => s.id as string);
    if (siblingIds.length > 0) {
      const { data: existingDraw } = await supabase
        .from("class_draws")
        .select("shared_run_id, position")
        .in("entry_class_id", siblingIds)
        .limit(1)
        .maybeSingle();
      if (existingDraw) {
        sharedRunId = existingDraw.shared_run_id;
        position = existingDraw.position;
      }
    }
  }

  if (!sharedRunId) {
    sharedRunId = crypto.randomUUID();
    const { data: maxRow } = await supabase
      .from("class_draws")
      .select("position")
      .in("class_id", groupClassIds)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (maxRow?.position ?? 0) + 1;
  }

  const { data: created, error } = await supabase
    .from("class_draws")
    .insert({
      class_id: ec.class_id,
      entry_class_id: entryClassId,
      position,
      shared_run_id: sharedRunId,
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
    p_new: { class_id: ec.class_id, position },
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
