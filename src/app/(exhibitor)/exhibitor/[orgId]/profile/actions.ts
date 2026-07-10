"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  exhibitorUpdateProfileSchema,
  type ExhibitorUpdateProfileInput,
} from "@/lib/validation/person";

export type ActionResult = { error?: string };

export async function updateOwnProfile(
  input: ExhibitorUpdateProfileInput
): Promise<ActionResult> {
  const parsed = exhibitorUpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("organization_id")
    .eq("id", d.personId)
    .maybeSingle();
  if (!person) return { error: "Profile not found." };

  const { error } = await supabase.rpc("exhibitor_update_person", {
    p_person: d.personId,
    p_preferred_name: d.preferredName ?? "",
    p_email: d.email ?? "",
    p_phone: d.phone ?? "",
    p_city: d.city ?? "",
    p_state: d.state ?? "",
    p_birthdate: d.birthdate || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/exhibitor/${person.organization_id}/profile`);
  return {};
}
