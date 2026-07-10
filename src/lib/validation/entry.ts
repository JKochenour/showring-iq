import { z } from "zod";

const uuidOrEmpty = z.uuid().or(z.literal("")).optional();

/** Checkbox groups arrive as string[] (or false when nothing is checked). */
const classIdsField = z.preprocess(
  (v) => (v === false || v == null ? [] : typeof v === "string" ? [v] : v),
  z.array(z.uuid()).min(1, "Select at least one class")
);

export const createEntrySchema = z
  .object({
    showId: z.uuid(),
    riderPersonId: z.uuid("Choose a rider"),
    horseId: z.uuid("Choose a horse"),
    ownerPersonId: uuidOrEmpty,
    trainerPersonId: uuidOrEmpty,
    classIds: classIdsField,
    backNumberMode: z.enum(["auto", "manual", "none"]),
    backNumber: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().int("Whole numbers only").min(1).max(9999).optional()
    ),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.backNumberMode !== "manual" || d.backNumber !== undefined, {
    message: "Enter the back number",
    path: ["backNumber"],
  });

export const addEntryClassSchema = z.object({
  entryId: z.uuid(),
  classId: z.uuid("Choose a class"),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type CreateEntryFormValues = z.input<typeof createEntrySchema>;
export type AddEntryClassInput = z.infer<typeof addEntryClassSchema>;
