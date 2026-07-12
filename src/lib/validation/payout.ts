import { z } from "zod";

/** One row per placing; percent must be 0-100. The schedule doesn't have
 * to sum to 100 (some shows hold back money for year-end funds, etc.) but
 * we warn in the UI if it's unusual. */
export const payoutScheduleRowSchema = z.object({
  placing: z.coerce.number().int().min(1).max(50),
  percent: z.coerce.number().min(0).max(100),
});

export const updatePayoutSettingsSchema = z.object({
  classId: z.uuid(),
  retainagePercent: z.coerce.number().min(0).max(100),
  schedule: z.array(payoutScheduleRowSchema).max(50),
});

/** A common starting point — NOT a verified NRHA/association formula.
 * The show manager must confirm real percentages before relying on it. */
export const EXAMPLE_PAYOUT_SCHEDULE = [
  { placing: 1, percent: 30 },
  { placing: 2, percent: 24 },
  { placing: 3, percent: 19 },
  { placing: 4, percent: 14 },
  { placing: 5, percent: 8 },
  { placing: 6, percent: 5 },
];

export type UpdatePayoutSettingsInput = z.infer<typeof updatePayoutSettingsSchema>;

/** Single Purse structure (Show Rules I(7)) — office-declared rider
 * eligibility level, 1-4. Level 1 is the least restrictive (can cash
 * anywhere in the paid placings); level 4 the most (top tier only). */
export const setRiderLevelSchema = z.object({
  entryClassId: z.uuid(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.null()]),
});

export type SetRiderLevelInput = z.infer<typeof setRiderLevelSchema>;
