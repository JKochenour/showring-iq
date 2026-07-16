"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const requestAccessSchema = z.object({
  organizationId: z.uuid("Choose an organization"),
  message: z.string().trim().max(1000).optional(),
});

/** Files a self-serve exhibitor join request (00049). The office
 * reviews it on their People page; approval links a person record and
 * grants exhibitor membership. */
export async function requestExhibitorAccess(input: {
  organizationId: string;
  message?: string;
}): Promise<ActionResult> {
  const parsed = requestAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_exhibitor_access", {
    p_org: parsed.data.organizationId,
    p_message: parsed.data.message || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/exhibitor");
  return {};
}
