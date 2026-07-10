"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addEntryClassSchema,
  createEntrySchema,
  type AddEntryClassInput,
  type CreateEntryInput,
} from "@/lib/validation/entry";

export type ActionResult = { error?: string };

function friendlyBackNumberError(message: string): string {
  if (message.includes("back_numbers_show_id_number_key")) {
    return "That back number is already in use at this show.";
  }
  return message;
}

export async function createEntry(
  input: CreateEntryInput
): Promise<ActionResult> {
  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // Resolve name snapshots and validate the selected classes up front
  const peopleIds = [
    d.riderPersonId,
    d.ownerPersonId || null,
    d.trainerPersonId || null,
  ].filter(Boolean) as string[];

  const [{ data: show }, { data: people }, { data: horse }, { data: classes }] =
    await Promise.all([
      supabase
        .from("shows")
        .select("organization_id")
        .eq("id", d.showId)
        .maybeSingle(),
      supabase
        .from("people")
        .select("id, first_name, last_name")
        .in("id", peopleIds),
      supabase
        .from("horses")
        .select("id, registered_name")
        .eq("id", d.horseId)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("id, class_number, name, entry_fee_cents, status")
        .eq("show_id", d.showId)
        .in("id", d.classIds),
    ]);

  if (!show) return { error: "Show not found." };
  if (!horse) return { error: "Horse not found." };

  const nameOf = (personId: string | undefined | null) => {
    if (!personId) return null;
    const person = people?.find((p) => p.id === personId);
    return person ? `${person.first_name} ${person.last_name}` : null;
  };
  const riderName = nameOf(d.riderPersonId);
  if (!riderName) return { error: "Rider not found." };

  if (!classes || classes.length !== d.classIds.length) {
    return { error: "One or more selected classes weren't found in this show." };
  }
  const closed = classes.filter((c) =>
    ["cancelled", "archived"].includes(c.status)
  );
  if (closed.length > 0) {
    return {
      error: `Class ${closed[0].class_number} (${closed[0].name}) is ${closed[0].status}.`,
    };
  }

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({
      show_id: d.showId,
      rider_person_id: d.riderPersonId,
      horse_id: d.horseId,
      owner_person_id: d.ownerPersonId || null,
      trainer_person_id: d.trainerPersonId || null,
      rider_name: riderName,
      horse_name: horse.registered_name,
      owner_name: nameOf(d.ownerPersonId),
      trainer_name: nameOf(d.trainerPersonId),
      notes: d.notes || null,
    })
    .select("id, entry_number")
    .maybeSingle();

  if (entryError) return { error: entryError.message };
  if (!entry) {
    return {
      error:
        "Entry was not created. You may lack the entry.create permission, or the show is locked/archived.",
    };
  }

  const { error: classesError } = await supabase.from("entry_classes").insert(
    classes.map((c) => ({
      entry_id: entry.id,
      class_id: c.id,
      fee_cents: c.entry_fee_cents,
    }))
  );

  if (classesError) {
    // Best-effort cleanup so we don't leave a classless entry behind
    await supabase.from("entries").delete().eq("id", entry.id);
    return { error: classesError.message };
  }

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "entry.created",
    p_entity_type: "entry",
    p_entity_id: entry.id,
    p_old: null,
    p_new: {
      entry_number: entry.entry_number,
      rider: riderName,
      horse: horse.registered_name,
      classes: classes.map((c) => c.class_number),
    },
  });

  if (d.backNumberMode !== "none") {
    const { error: backError } = await supabase.rpc("assign_back_number", {
      p_entry: entry.id,
      p_number: d.backNumberMode === "manual" ? d.backNumber : null,
    });
    if (backError) {
      // The entry exists; surface the back-number problem on the detail page
      revalidatePath(`/shows/${d.showId}/entries`);
      redirect(
        `/shows/${d.showId}/entries/${entry.id}?error=${encodeURIComponent(
          friendlyBackNumberError(backError.message)
        )}`
      );
    }
  }

  revalidatePath(`/shows/${d.showId}/entries`);
  redirect(`/shows/${d.showId}/entries/${entry.id}`);
}

export async function addEntryClass(
  input: AddEntryClassInput
): Promise<ActionResult> {
  const parsed = addEntryClassSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const [{ data: entry }, { data: cls }] = await Promise.all([
    supabase
      .from("entries")
      .select("show_id, organization_id, entry_number")
      .eq("id", d.entryId)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id, class_number, name, entry_fee_cents, status")
      .eq("id", d.classId)
      .maybeSingle(),
  ]);

  if (!entry) return { error: "Entry not found." };
  if (!cls) return { error: "Class not found." };
  if (["cancelled", "archived"].includes(cls.status)) {
    return { error: `Class ${cls.class_number} is ${cls.status}.` };
  }

  const { data: created, error } = await supabase
    .from("entry_classes")
    .insert({
      entry_id: d.entryId,
      class_id: d.classId,
      fee_cents: cls.entry_fee_cents,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("entry_classes_entry_id_class_id_key")) {
      return { error: "This entry is already in that class." };
    }
    return { error: error.message };
  }
  if (!created) {
    return {
      error:
        "Class was not added. You may lack the entry.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: entry.organization_id,
    p_action: "entry.class_added",
    p_entity_type: "entry_class",
    p_entity_id: created.id,
    p_old: null,
    p_new: {
      entry_number: entry.entry_number,
      class: cls.class_number,
      fee_cents: cls.entry_fee_cents,
    },
  });

  revalidatePath(`/shows/${entry.show_id}/entries/${d.entryId}`);
  return {};
}

export async function removeEntryClass(
  entryClassId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("entry_classes")
    .select("entry_id, show_id, organization_id, status, class:classes(class_number)")
    .eq("id", entryClassId)
    .maybeSingle();
  if (!row) return { error: "Entry class not found." };

  const { data: deleted, error } = await supabase
    .from("entry_classes")
    .delete()
    .eq("id", entryClassId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Remove was not applied. Scratched classes can't be removed (they must stay for results), and removing requires entry.edit on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: row.organization_id,
    p_action: "entry.class_removed",
    p_entity_type: "entry_class",
    p_entity_id: entryClassId,
    p_old: {
      entry_id: row.entry_id,
      class: (row.class as unknown as { class_number: number } | null)?.class_number,
    },
    p_new: null,
  });

  revalidatePath(`/shows/${row.show_id}/entries/${row.entry_id}`);
  return {};
}

export async function scratchEntryClass(
  entryClassId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("entry_classes")
    .select("entry_id, show_id")
    .eq("id", entryClassId)
    .maybeSingle();
  if (!row) return { error: "Entry class not found." };

  const { error } = await supabase.rpc("scratch_entry_class", {
    p_entry_class: entryClassId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${row.show_id}/entries/${row.entry_id}`);
  return {};
}

export async function reinstateEntryClass(
  entryClassId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("entry_classes")
    .select("entry_id, show_id")
    .eq("id", entryClassId)
    .maybeSingle();
  if (!row) return { error: "Entry class not found." };

  const { error } = await supabase.rpc("reinstate_entry_class", {
    p_entry_class: entryClassId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${row.show_id}/entries/${row.entry_id}`);
  return {};
}

export async function scratchEntry(
  entryId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("show_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase.rpc("scratch_entry", {
    p_entry: entryId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  revalidatePath(`/shows/${entry.show_id}/entries`);
  return {};
}

export async function reinstateEntry(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("show_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase.rpc("reinstate_entry", {
    p_entry: entryId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  revalidatePath(`/shows/${entry.show_id}/entries`);
  return {};
}

export async function assignBackNumber(
  entryId: string,
  number?: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("show_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase.rpc("assign_back_number", {
    p_entry: entryId,
    p_number: number ?? null,
  });
  if (error) return { error: friendlyBackNumberError(error.message) };

  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  revalidatePath(`/shows/${entry.show_id}/entries`);
  return {};
}

export async function releaseBackNumber(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("show_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase.rpc("release_back_number", {
    p_entry: entryId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  revalidatePath(`/shows/${entry.show_id}/entries`);
  return {};
}

export async function deleteEntry(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("entries")
    .select("show_id, organization_id, entry_number, rider_name, horse_name")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { data: deleted, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", entryId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return {
      error:
        "Delete was not applied. It requires the entry.delete permission on an unlocked show.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: entry.organization_id,
    p_action: "entry.deleted",
    p_entity_type: "entry",
    p_entity_id: entryId,
    p_old: {
      entry_number: entry.entry_number,
      rider: entry.rider_name,
      horse: entry.horse_name,
    },
    p_new: null,
  });

  revalidatePath(`/shows/${entry.show_id}/entries`);
  redirect(`/shows/${entry.show_id}/entries`);
}
