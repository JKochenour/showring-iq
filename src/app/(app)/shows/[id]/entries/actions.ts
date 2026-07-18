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
  if (
    message.includes("weekend_back_numbers_weekend_id_number_key") ||
    message.includes("already used by another horse")
  ) {
    return "That back number is already used by another horse this circuit.";
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
    d.payeePersonId || null,
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
      payee_person_id: d.payeePersonId || null,
      payee_name: nameOf(d.payeePersonId),
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

  const { data: createdClasses, error: classesError } = await supabase
    .from("entry_classes")
    .insert(
      classes.map((c) => ({
        entry_id: entry.id,
        class_id: c.id,
        fee_cents: c.entry_fee_cents,
      }))
    )
    .select("id");

  if (classesError) {
    // Best-effort cleanup so we don't leave a classless entry behind
    await supabase.from("entries").delete().eq("id", entry.id);
    return { error: classesError.message };
  }

  // Run fees (judge/video/photo) are computed live per run in billing.ts
  // (00042), not materialized per class — nothing to apply here.

  if (d.lateEntry) {
    await supabase.rpc("apply_late_entry_fee", { p_entry: entry.id });
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
    p_show: d.showId,
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

/** Other shows in the same org an entry could be copied FROM, newest
 * first, excluding the target show itself — for a same-weekend
 * "Show 1 / Show 2" back-to-back entry copy. */
export async function listSourceShowsForCopy(
  targetShowId: string,
  organizationId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shows")
    .select("id, name")
    .eq("organization_id", organizationId)
    .neq("id", targetShowId)
    .order("start_date", { ascending: false })
    .limit(20);
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
}

export async function listEntriesForCopy(
  sourceShowId: string
): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("id, entry_number, rider_name, horse_name")
    .eq("show_id", sourceShowId)
    .eq("status", "active")
    .order("entry_number");
  return (data ?? []).map((e) => ({
    id: e.id as string,
    label: `#${e.entry_number} — ${e.rider_name} on ${e.horse_name}`,
  }));
}

export interface CopyableEntry {
  riderPersonId: string;
  ownerPersonId: string;
  trainerPersonId: string;
  payeePersonId: string;
  horseId: string;
  notes: string;
  /** Class ids in the TARGET show whose name matches a class the
   * source entry was in — a convenience pre-selection, not a
   * guarantee; fees always come from the target show's own classes. */
  matchedClassIds: string[];
}

export async function getEntryForCopy(
  sourceEntryId: string,
  targetShowId: string
): Promise<CopyableEntry | { error: string }> {
  const supabase = await createClient();

  const [{ data: entry }, { data: sourceClasses }, { data: targetClasses }] =
    await Promise.all([
      supabase
        .from("entries")
        .select("rider_person_id, owner_person_id, trainer_person_id, payee_person_id, horse_id, notes")
        .eq("id", sourceEntryId)
        .maybeSingle(),
      supabase
        .from("entry_classes")
        .select("class:classes(name)")
        .eq("entry_id", sourceEntryId)
        .eq("status", "entered"),
      supabase.from("classes").select("id, name").eq("show_id", targetShowId),
    ]);

  if (!entry) return { error: "Source entry not found." };

  const sourceNames = new Set(
    (sourceClasses ?? [])
      .map((ec) => (ec.class as unknown as { name: string } | null)?.name?.toLowerCase())
      .filter((n): n is string => !!n)
  );
  const matchedClassIds = (targetClasses ?? [])
    .filter((c) => sourceNames.has((c.name as string).toLowerCase()))
    .map((c) => c.id as string);

  return {
    riderPersonId: entry.rider_person_id as string,
    ownerPersonId: (entry.owner_person_id as string | null) ?? "",
    trainerPersonId: (entry.trainer_person_id as string | null) ?? "",
    payeePersonId: (entry.payee_person_id as string | null) ?? "",
    horseId: entry.horse_id as string,
    notes: (entry.notes as string | null) ?? "",
    matchedClassIds,
  };
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
    p_show: entry.show_id,
  });

  // Run fees are computed live per run in billing.ts (00042) — adding this
  // class simply changes the run structure the bill reads from.

  revalidatePath(`/shows/${entry.show_id}/entries/${d.entryId}`);
  revalidatePath(`/shows/${entry.show_id}/financials`);
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
    p_show: row.show_id,
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

/** Toggles barn billing for one entry: when true, the entry's charges
 * bill to its trainer instead of the owner/rider (see 00035). A plain
 * column update, not an RPC — entries.bill_to_trainer already has an
 * entry.edit-gated update grant and a DB check that a trainer is set. */
export async function setEntryBillToTrainer(
  entryId: string,
  billToTrainer: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("entries")
    .select("show_id, organization_id, trainer_person_id, trainer_name")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };
  if (billToTrainer && !entry.trainer_person_id) {
    return { error: "Add a trainer to this entry before billing them." };
  }

  const { data: updated, error } = await supabase
    .from("entries")
    .update({ bill_to_trainer: billToTrainer })
    .eq("id", entryId)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error: "Update was not applied. You may lack the entry.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: entry.organization_id,
    p_action: billToTrainer ? "entry.billed_to_trainer" : "entry.billed_to_trainer_unset",
    p_entity_type: "entry",
    p_entity_id: entryId,
    p_old: null,
    p_new: { bill_to_trainer: billToTrainer, trainer_name: entry.trainer_name },
    p_show: entry.show_id,
  });

  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  revalidatePath(`/shows/${entry.show_id}/financials`);
  return {};
}

/** Sets (or clears) the entry's payee — the party who receives winning
 * checks, separate from who pays the bill. Null reverts to the default
 * (owner of record, falling back to rider). Plain column update like
 * bill_to_trainer: entries.payee_person_id has an entry.edit-gated
 * update grant (00044). */
export async function setEntryPayee(
  entryId: string,
  payeePersonId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("entries")
    .select("show_id, organization_id, payee_name")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  let payeeName: string | null = null;
  if (payeePersonId) {
    const { data: person } = await supabase
      .from("people")
      .select("first_name, last_name, organization_id")
      .eq("id", payeePersonId)
      .maybeSingle();
    if (!person || person.organization_id !== entry.organization_id) {
      return { error: "Payee not found in this organization." };
    }
    payeeName = `${person.first_name} ${person.last_name}`;
  }

  const { data: updated, error } = await supabase
    .from("entries")
    .update({ payee_person_id: payeePersonId, payee_name: payeeName })
    .eq("id", entryId)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error: "Update was not applied. You may lack the entry.edit permission, or the show is locked/archived.",
    };
  }

  await supabase.rpc("log_audit", {
    p_org: entry.organization_id,
    p_action: payeePersonId ? "entry.payee_set" : "entry.payee_cleared",
    p_entity_type: "entry",
    p_entity_id: entryId,
    p_old: { payee_name: entry.payee_name },
    p_new: { payee_name: payeeName },
    p_show: entry.show_id,
  });

  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  revalidatePath(`/organizations/${entry.organization_id}/payee-report`);
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
    p_show: entry.show_id,
  });

  revalidatePath(`/shows/${entry.show_id}/entries`);
  redirect(`/shows/${entry.show_id}/entries`);
}
