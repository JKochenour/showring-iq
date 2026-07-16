"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addShowToWeekendSchema,
  createWeekendEntrySchema,
  groupShowsSchema,
  renameWeekendSchema,
  type AddShowToWeekendInput,
  type CreateWeekendEntryInput,
  type GroupShowsInput,
  type RenameWeekendInput,
} from "@/lib/validation/weekend";

export type ActionResult = { error?: string };

export async function groupShowsIntoWeekend(
  input: GroupShowsInput
): Promise<ActionResult> {
  const parsed = groupShowsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("group_shows_into_weekend", {
    p_org: d.organizationId,
    p_name: d.name,
    p_show_ids: d.showIds,
  });
  if (error) return { error: error.message };

  revalidatePath(`/organizations/${d.organizationId}/weekends`);
  redirect(`/organizations/${d.organizationId}/weekends/${data}`);
}

export async function renameWeekend(
  input: RenameWeekendInput
): Promise<ActionResult> {
  const parsed = renameWeekendSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_weekend", {
    p_weekend: d.weekendId,
    p_name: d.name,
  });
  if (error) return { error: error.message };

  revalidatePath(`/organizations/${d.organizationId}/weekends/${d.weekendId}`);
  return {};
}

export async function addShowToWeekend(
  input: AddShowToWeekendInput
): Promise<ActionResult> {
  const parsed = addShowToWeekendSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_show_to_weekend", {
    p_show: d.showId,
    p_weekend: d.weekendId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/organizations/${d.organizationId}/weekends/${d.weekendId}`);
  return {};
}

/** Create/extend a horse+rider sign-up across a weekend's slates. Finds an
 * existing (slate, horse, rider) entry and adds only the newly-checked
 * classes, so "add a day later" and "add another class" are the same call.
 * Each new class fires its per-run charges; the horse's shared weekend back
 * number is assigned (which also applies the once-per-weekend office/stall/
 * drug charge the first time this horse is numbered). */
export async function createWeekendEntry(
  input: CreateWeekendEntryInput
): Promise<{ error?: string; weekendId?: string; organizationId?: string }> {
  const parsed = createWeekendEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: weekend } = await supabase
    .from("show_weekends")
    .select("id, organization_id")
    .eq("id", d.weekendId)
    .maybeSingle();
  if (!weekend) return { error: "Weekend not found." };

  const slateShowIds = d.slates.map((s) => s.showId);
  const { data: weekendShows } = await supabase
    .from("shows")
    .select("id, weekend_id")
    .in("id", slateShowIds);
  const validShowIds = new Set(
    (weekendShows ?? [])
      .filter((s) => s.weekend_id === d.weekendId)
      .map((s) => s.id as string)
  );
  if (validShowIds.size === 0) {
    return { error: "None of the selected slates belong to this weekend." };
  }

  // Resolve display-name snapshots and validate the picked classes.
  const wantedClassIds = [...new Set(d.slates.flatMap((s) => s.classIds))];
  const peopleIds = [
    d.riderPersonId,
    d.ownerPersonId || null,
    d.payeePersonId || null,
  ].filter(Boolean) as string[];

  const [{ data: people }, { data: horse }, { data: classes }] =
    await Promise.all([
      supabase.from("people").select("id, first_name, last_name").in("id", peopleIds),
      supabase.from("horses").select("id, registered_name").eq("id", d.horseId).maybeSingle(),
      wantedClassIds.length > 0
        ? supabase
            .from("classes")
            .select("id, class_number, name, entry_fee_cents, status, show_id")
            .in("id", wantedClassIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  if (!horse) return { error: "Horse not found." };
  const nameOf = (personId: string | null | undefined) => {
    if (!personId) return null;
    const p = people?.find((x) => x.id === personId);
    return p ? `${p.first_name} ${p.last_name}` : null;
  };
  const riderName = nameOf(d.riderPersonId);
  if (!riderName) return { error: "Rider not found." };
  const ownerPersonId = d.billTo === "owner" ? d.ownerPersonId || null : null;
  const ownerName = nameOf(ownerPersonId);
  const payeePersonId = d.payeePersonId || null;
  const payeeName = nameOf(payeePersonId);
  if (payeePersonId && !payeeName) return { error: "Payee not found." };

  const classById = new Map(
    (classes ?? []).map((c) => [
      c.id as string,
      c as {
        id: string;
        class_number: number;
        name: string;
        entry_fee_cents: number;
        status: string;
        show_id: string;
      },
    ])
  );

  let anyCreated = false;

  for (const slate of d.slates) {
    if (!validShowIds.has(slate.showId)) continue;
    // Only classes that belong to THIS slate and aren't cancelled/archived.
    const slateClasses = slate.classIds
      .map((cid) => classById.get(cid))
      .filter(
        (c): c is NonNullable<typeof c> =>
          !!c &&
          c.show_id === slate.showId &&
          !["cancelled", "archived"].includes(c.status)
      );
    if (slateClasses.length === 0) continue;

    // Find-or-create the (slate, horse, rider) entry.
    const { data: existing } = await supabase
      .from("entries")
      .select("id")
      .eq("show_id", slate.showId)
      .eq("horse_id", d.horseId)
      .eq("rider_person_id", d.riderPersonId)
      .limit(1);

    let entryId = existing?.[0]?.id as string | undefined;

    if (!entryId) {
      const { data: entry, error: entryError } = await supabase
        .from("entries")
        .insert({
          show_id: slate.showId,
          rider_person_id: d.riderPersonId,
          horse_id: d.horseId,
          owner_person_id: ownerPersonId,
          rider_name: riderName,
          horse_name: horse.registered_name,
          owner_name: ownerName,
          payee_person_id: payeePersonId,
          payee_name: payeeName,
        })
        .select("id")
        .maybeSingle();
      if (entryError) return { error: entryError.message };
      if (!entry) {
        return {
          error:
            "Entry couldn't be created — you may lack entry.create, or the slate is locked.",
        };
      }
      entryId = entry.id as string;
    }

    // Add only classes not already on this entry.
    const { data: existingECs } = await supabase
      .from("entry_classes")
      .select("class_id")
      .eq("entry_id", entryId);
    const alreadyIn = new Set((existingECs ?? []).map((r) => r.class_id as string));
    const toAdd = slateClasses.filter((c) => !alreadyIn.has(c.id));

    if (toAdd.length > 0) {
      const { error: ecError } = await supabase
        .from("entry_classes")
        .insert(toAdd.map((c) => ({ entry_id: entryId, class_id: c.id, fee_cents: c.entry_fee_cents })));
      if (ecError) return { error: ecError.message };
      // Run fees (judge/video/photo) are computed live per run in billing.ts
      // (00042) from these classes — nothing to materialize here.
    }

    // Share the horse's weekend back number (also applies the once-per-
    // weekend office/stall/drug the first time this horse gets a number).
    await supabase.rpc("assign_back_number", { p_entry: entryId });
    anyCreated = true;
  }

  if (!anyCreated) {
    return { error: "Nothing to enter — pick at least one class in a slate." };
  }

  await supabase.rpc("log_audit", {
    p_org: weekend.organization_id,
    p_action: "weekend.entry_created",
    p_entity_type: "show_weekend",
    p_entity_id: d.weekendId,
    p_old: null,
    p_new: {
      horse: horse.registered_name,
      rider: riderName,
      slates: d.slates
        .filter((s) => s.classIds.length > 0)
        .map((s) => ({ show_id: s.showId, classes: s.classIds.length })),
      bill_to: d.billTo,
      payee: payeeName,
    },
  });

  revalidatePath(`/organizations/${weekend.organization_id}/weekends/${d.weekendId}`);
  return { weekendId: d.weekendId, organizationId: weekend.organization_id as string };
}
