import { z } from "zod";
import { MONEY_PATTERN } from "@/lib/money";

/** Common starting points shown as quick-pick buttons — the category
 * field itself is free text, since real shows invent new charge types
 * constantly (ice, sponsorships, apparel, and whatever comes next). */
export const CHARGE_CATEGORY_SUGGESTIONS = [
  "Ice",
  "Stabling",
  "Shavings",
  "Sponsorship",
  "Apparel",
  "Office fee",
  "Other",
] as const;

export const addMiscChargeSchema = z.object({
  showId: z.uuid(),
  personId: z.uuid(),
  description: z.string().trim().min(1, "Description is required").max(200),
  category: z.string().trim().max(60).optional(),
  amount: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter a dollar amount like 25 or 25.00"),
});

export type AddMiscChargeInput = z.infer<typeof addMiscChargeSchema>;
