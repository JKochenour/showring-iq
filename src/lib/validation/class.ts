import { z } from "zod";
import { MONEY_PATTERN } from "@/lib/money";

/** Class statuses a user can set directly. Later stages
 * (draw_posted, scoring, official, …) are driven by their own workflows. */
export const CLASS_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open for entries" },
  { value: "entry_closed", label: "Entry closed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

/** Full status set, matching the classes.status check constraint. The
 * update form only exposes CLASS_STATUS_OPTIONS as choices (later
 * stages are workflow-driven), but validation must still accept a
 * class's current later-stage status when the form round-trips it
 * unchanged — otherwise every edit to an in-progress class (e.g. a
 * pattern number tweak) fails with "invalid status" even though status
 * itself was never touched. */
export const ALL_CLASS_STATUSES = [
  "draft",
  "open",
  "entry_closed",
  "draw_posted",
  "in_progress",
  "scoring",
  "pending_verification",
  "official",
  "results_posted",
  "exported",
  "archived",
  "cancelled",
] as const;

export const DISCIPLINES = [
  "Reining",
  "Ranch Riding",
  "Cow Horse",
  "Cutting",
  "Western Pleasure",
  "Trail",
  "Other",
] as const;

const money = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, "Enter a dollar amount like 25 or 25.00")
  .or(z.literal(""));

const AVG_RUN_MINUTES_PATTERN = /^\d{1,3}(\.\d)?$/;

const optionalInt = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int("Whole numbers only").min(1).max(max).optional()
  );

const classFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(160),
  classNumber: z.coerce
    .number("Enter the class number")
    .int("Whole numbers only")
    .min(1)
    .max(9999),
  discipline: z.string().trim().max(80).optional(),
  division: z.string().trim().max(80).optional(),
  patternNumber: optionalInt(999),
  dragEveryN: optionalInt(50),
  avgRunMinutes: z
    .string()
    .trim()
    .regex(AVG_RUN_MINUTES_PATTERN, "Enter minutes like 3 or 3.5"),
  isYouth: z.boolean(),
  isSinglePurse: z.boolean(),
  entryFee: money,
  judgeFee: money,
  addedMoney: money,
  scheduledDate: z.iso.date("Enter a valid date").or(z.literal("")).optional(),
  arena: z.string().trim().max(80).optional(),
  nrhaClassCode: z.string().trim().max(20).optional(),
  classCodeId: z.uuid().or(z.literal("")).optional(),
  notes: z.string().trim().max(1000).optional(),
};

export const createClassSchema = z.object({
  showId: z.uuid(),
  ...classFields,
});

export const updateClassSchema = z.object({
  classId: z.uuid(),
  status: z.enum(ALL_CLASS_STATUSES),
  ...classFields,
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
// Raw form-value types (before zod coercion of numeric fields)
export type CreateClassFormValues = z.input<typeof createClassSchema>;
export type UpdateClassFormValues = z.input<typeof updateClassSchema>;

/** One reviewed row from the show-bill import preview. Money as dollar
 * strings (matches the other class forms); fees default to 0 when blank. */
export const importBillClassRowSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  entryFee: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter a dollar amount")
    .or(z.literal(""))
    .optional(),
  addedMoney: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter a dollar amount")
    .or(z.literal(""))
    .optional(),
  scheduledDate: z.iso.date().or(z.literal("")).optional(),
  arena: z.string().trim().max(80).optional(),
  patternNumber: z.coerce.number().int().min(1).max(999).nullable().optional(),
  isYouth: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
});

export const importBillClassesSchema = z.object({
  showId: z.uuid(),
  classes: z.array(importBillClassRowSchema).min(1, "Nothing to import").max(300),
});

export type ImportBillClassRow = z.infer<typeof importBillClassRowSchema>;
export type ImportBillClassesInput = z.infer<typeof importBillClassesSchema>;

export const addClassAffiliationSchema = z.object({
  classId: z.uuid(),
  associationClassCodeId: z.uuid("Choose a class code"),
  countsForMoney: z.boolean(),
  countsForPoints: z.boolean(),
  countsForYearEnd: z.boolean(),
  isPrimary: z.boolean(),
});

export const updateClassAffiliationSchema = z.object({
  classAffiliationId: z.uuid(),
  countsForMoney: z.boolean(),
  countsForPoints: z.boolean(),
  countsForYearEnd: z.boolean(),
  isPrimary: z.boolean(),
});

export type AddClassAffiliationInput = z.infer<typeof addClassAffiliationSchema>;
export type UpdateClassAffiliationInput = z.infer<typeof updateClassAffiliationSchema>;
