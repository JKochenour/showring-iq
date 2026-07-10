"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  overridePlacingSchema,
  type OverridePlacingInput,
} from "@/lib/validation/result";

export type ActionResult = { error?: string };

function revalidateResults(showId: string, classId: string) {
  revalidatePath(`/shows/${showId}/results`);
  revalidatePath(`/shows/${showId}/results/${classId}`);
  revalidatePath(`/shows/${showId}/classes`);
}

export async function calculateResults(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_results", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function publishResults(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_results", { p_class: classId });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function unpublishResults(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_results", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function overridePlacing(
  input: OverridePlacingInput,
  showId: string,
  classId: string
): Promise<ActionResult> {
  const parsed = overridePlacingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("override_placing", {
    p_entry_class: d.entryClassId,
    p_placing: d.placing,
    p_reason: d.reason,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}
