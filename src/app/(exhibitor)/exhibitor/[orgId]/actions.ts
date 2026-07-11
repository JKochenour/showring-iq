"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";

export type ActionResult = { error?: string };

export async function createExhibitorEntry(input: {
  organizationId: string;
  showId: string;
  horseId: string;
  classIds: string[];
  notes?: string;
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  if (!input.horseId) return { error: "Choose a horse." };
  if (input.classIds.length === 0) return { error: "Select at least one class." };

  const { data: person } = await supabase
    .from("people")
    .select("id, first_name, last_name")
    .eq("organization_id", input.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!person) return { error: "No exhibitor profile found for this organization." };

  const { data: horse } = await supabase
    .from("horses")
    .select("id, registered_name")
    .eq("id", input.horseId)
    .maybeSingle();
  if (!horse) return { error: "Horse not found or not yours." };

  const { data: classes } = await supabase
    .from("classes")
    .select("id, entry_fee_cents")
    .eq("show_id", input.showId)
    .in("id", input.classIds);
  if (!classes || classes.length === 0) return { error: "Selected classes not found." };

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({
      show_id: input.showId,
      rider_person_id: person.id,
      horse_id: horse.id,
      owner_person_id: person.id,
      rider_name: `${person.first_name} ${person.last_name}`,
      horse_name: horse.registered_name,
      owner_name: `${person.first_name} ${person.last_name}`,
      notes: input.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (entryError || !entry) {
    return {
      error:
        entryError?.message ??
        "Entry was not created — the show may no longer be open for self-service entry.",
    };
  }

  const { error: classesError } = await supabase.from("entry_classes").insert(
    classes.map((c) => ({
      entry_id: entry.id,
      class_id: c.id,
      fee_cents: c.entry_fee_cents,
    }))
  );
  if (classesError) return { error: classesError.message };

  await supabase.rpc("log_audit", {
    p_org: input.organizationId,
    p_action: "entry.created",
    p_entity_type: "entry",
    p_entity_id: entry.id,
    p_old: null,
    p_new: { show_id: input.showId, horse_name: horse.registered_name, source: "exhibitor" },
    p_show: input.showId,
  });

  revalidatePath(`/exhibitor/${input.organizationId}/entries`);
  redirect(`/exhibitor/${input.organizationId}/entries?submitted=${entry.id}`);
}

export async function exhibitorScratchEntryClass(
  entryClassId: string,
  organizationId: string,
  reason?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("exhibitor_scratch_entry_class", {
    p_entry_class: entryClassId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/exhibitor/${organizationId}/entries`);
  return {};
}
