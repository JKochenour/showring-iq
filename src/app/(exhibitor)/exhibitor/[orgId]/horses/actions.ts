"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { HORSE_SEXES } from "@/lib/validation/horse";

export type ActionResult = { error?: string };

const optionalYear = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce
    .number()
    .int("Whole years only")
    .min(1980, "Enter a 4-digit year")
    .max(2100, "Enter a 4-digit year")
    .optional()
);

const ownHorseFields = {
  barnName: z.string().trim().max(80).optional(),
  breed: z.string().trim().max(80).optional(),
  sex: z
    .enum(HORSE_SEXES.map((s) => s.value) as [string, ...string[]])
    .or(z.literal(""))
    .optional(),
  color: z.string().trim().max(60).optional(),
  foalYear: optionalYear,
  sire: z.string().trim().max(120).optional(),
  dam: z.string().trim().max(120).optional(),
};

export const createOwnHorseSchema = z.object({
  organizationId: z.uuid(),
  registeredName: z.string().trim().min(2, "Registered name is required").max(120),
  ...ownHorseFields,
});

export const updateOwnHorseSchema = z.object({
  horseId: z.uuid(),
  organizationId: z.uuid(),
  ...ownHorseFields,
});

export type CreateOwnHorseInput = z.infer<typeof createOwnHorseSchema>;
export type CreateOwnHorseFormValues = z.input<typeof createOwnHorseSchema>;
export type UpdateOwnHorseInput = z.infer<typeof updateOwnHorseSchema>;
export type UpdateOwnHorseFormValues = z.input<typeof updateOwnHorseSchema>;

export async function createOwnHorse(input: CreateOwnHorseInput): Promise<ActionResult> {
  const parsed = createOwnHorseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const { supabase } = await requireUser();

  const { data: horseId, error } = await supabase.rpc("exhibitor_create_horse", {
    p_org: d.organizationId,
    p_registered_name: d.registeredName,
    p_barn_name: d.barnName ?? "",
    p_breed: d.breed ?? "",
    p_sex: d.sex ?? "",
    p_color: d.color ?? "",
    p_foal_year: d.foalYear ?? null,
    p_sire: d.sire ?? "",
    p_dam: d.dam ?? "",
  });

  if (error) return { error: error.message };
  if (!horseId) return { error: "Horse was not created." };

  revalidatePath(`/exhibitor/${d.organizationId}/horses`);
  redirect(`/exhibitor/${d.organizationId}/horses/${horseId}`);
}

export async function updateOwnHorse(input: UpdateOwnHorseInput): Promise<ActionResult> {
  const parsed = updateOwnHorseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("exhibitor_update_horse", {
    p_horse: d.horseId,
    p_barn_name: d.barnName ?? "",
    p_breed: d.breed ?? "",
    p_sex: d.sex ?? "",
    p_color: d.color ?? "",
    p_foal_year: d.foalYear ?? null,
    p_sire: d.sire ?? "",
    p_dam: d.dam ?? "",
  });

  if (error) return { error: error.message };

  revalidatePath(`/exhibitor/${d.organizationId}/horses/${d.horseId}`);
  return {};
}
