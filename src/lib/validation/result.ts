import { z } from "zod";

export const overridePlacingSchema = z.object({
  entryClassId: z.uuid(),
  placing: z.coerce
    .number("Enter a placing")
    .int("Whole numbers only")
    .min(1)
    .max(999),
  reason: z.string().trim().min(3, "Reason is required").max(500),
});

export type OverridePlacingInput = z.infer<typeof overridePlacingSchema>;
