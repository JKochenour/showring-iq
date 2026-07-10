"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

export async function checkInEntry(
  entryId: string,
  overrideReason?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("show_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase.rpc("check_in_entry", {
    p_entry: entryId,
    p_override_reason: overrideReason || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${entry.show_id}/check-in`);
  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  return {};
}

export async function undoCheckIn(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("show_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase.rpc("undo_check_in", {
    p_entry: entryId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/shows/${entry.show_id}/check-in`);
  revalidatePath(`/shows/${entry.show_id}/entries/${entryId}`);
  return {};
}
