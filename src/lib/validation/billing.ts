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

/** "card" means a card taken on the org's own terminal (EPRHA runs
 * Clover) — the platform records it, it never processes cards. */
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card (terminal)" },
  { value: "other", label: "Other" },
] as const;

export const recordPaymentSchema = z.object({
  showId: z.uuid(),
  personId: z.uuid(),
  method: z.enum(["cash", "check", "card", "other"]),
  amount: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter a dollar amount like 25 or 25.00"),
  reference: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(200).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const recordRefundSchema = z.object({
  paymentId: z.uuid(),
  amount: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter a dollar amount like 25 or 25.00"),
  reason: z.string().trim().min(3, "A reason is required").max(200),
  method: z.enum(["cash", "check", "card", "other"]).optional(),
});

export type RecordRefundInput = z.infer<typeof recordRefundSchema>;
