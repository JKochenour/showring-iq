import { z } from "zod";
import { MONEY_PATTERN } from "@/lib/money";

const optionalMoney = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, "Enter a dollar amount like 25 or 25.00")
  .or(z.literal(""))
  .optional();

const optionalPercent = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0).max(100).optional()
);

export const createAssociationSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2, "Name is required").max(40),
});

export const createRulePackageSchema = z.object({
  associationId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  version: z.string().trim().min(1).max(20),
  sourceNotes: z.string().trim().max(1000).optional(),
});

export const RULE_PACKAGE_STATUS_OPTIONS = [
  "draft",
  "review",
  "tested",
  "published",
  "deprecated",
  "archived",
] as const;

export const createClassCodeSchema = z.object({
  rulePackageId: z.uuid(),
  code: z.string().trim().min(1, "Code is required").max(20),
  name: z.string().trim().min(2, "Name is required").max(160),
  discipline: z.string().trim().max(80).optional(),
  division: z.string().trim().max(80).optional(),
  isYouth: z.boolean().default(false),
  isAmateur: z.boolean().default(false),
  isOpen: z.boolean().default(false),
  isNonPro: z.boolean().default(false),
  countsForPoints: z.boolean().default(true),
  countsForMoney: z.boolean().default(true),
  maxAddedMoney: optionalMoney,
  maxEntryFee: optionalMoney,
  maxEntryFeePercentOfAddedMoney: optionalPercent,
  maxEntryFeeJackpot: optionalMoney,
});

export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "greater_than",
  "less_than",
  "exists",
] as const;

export const createEligibilityRuleSchema = z.object({
  rulePackageId: z.uuid(),
  ruleKey: z.string().trim().min(2, "Rule key is required").max(80),
  appliesTo: z.string().trim().max(400).optional(),
  field: z.string().trim().min(1, "Field is required").max(120),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().trim().max(400).optional(),
  severity: z.enum(["info", "warning", "blocking", "critical"]),
  message: z.string().trim().min(3, "Message is required").max(500),
});

export type CreateAssociationInput = z.infer<typeof createAssociationSchema>;
export type CreateRulePackageInput = z.infer<typeof createRulePackageSchema>;
export type CreateRulePackageFormValues = z.input<typeof createRulePackageSchema>;
export type CreateClassCodeInput = z.infer<typeof createClassCodeSchema>;
export type CreateClassCodeFormValues = z.input<typeof createClassCodeSchema>;
export type CreateEligibilityRuleInput = z.infer<typeof createEligibilityRuleSchema>;
