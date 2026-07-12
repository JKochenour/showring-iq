import type { PayoutScheduleEntry } from "@/lib/types";

/**
 * NRHA Payback Schedules A & B, transcribed from the 2024 NRHA Handbook
 * ("NRHA Payback Schedules A & B", Show Rules section).
 *
 * Like the official pattern library (nrha-patterns.ts), this is fixed
 * association reference material, not org-configurable rule-package data —
 * the tables are published by NRHA and identical for every show. The
 * schedules only pre-fill a class's editable payout_schedule; nothing
 * downstream reads this module at payout time.
 *
 * Both schedules share the same percentage rows for a given number of paid
 * places — they differ only in how fast the number of places grows with
 * the entry count (Schedule B, for $2,000-or-more-added Category 1
 * classes, escalates faster and reaches 15 places at 30+ entries vs 61+
 * for Schedule A).
 */

export type PaybackScheduleId = "A" | "B";

/** Percent of the purse by placing, keyed by number of places paid.
 * Every row sums to exactly 100. */
const PERCENT_ROWS: Record<number, number[]> = {
  1: [100],
  2: [60, 40],
  3: [45, 35, 20],
  4: [40, 30, 20, 10],
  5: [34, 27, 20, 10, 9],
  6: [32, 22, 19, 10, 9, 8],
  7: [28, 22, 17, 10, 9, 8, 6],
  8: [26, 22, 14, 10, 9, 8, 6, 5],
  9: [25, 20, 13, 10, 9, 8, 6, 5, 4],
  10: [25, 18, 13, 10, 8.5, 7, 6, 5, 4, 3.5],
  11: [25, 17, 12, 9.5, 8, 7, 6, 5, 4, 3.5, 3],
  12: [23, 17, 12, 9, 8, 7, 6, 5, 4, 3.5, 3, 2.5],
  13: [23, 16, 11, 9, 8, 7, 6, 5, 4, 3.5, 3, 2.5, 2],
  14: [23, 15, 10.5, 9, 8, 7, 6, 5, 4, 3.5, 3, 2.5, 2, 1.5],
  15: [23, 14, 10.5, 9, 8, 7, 6, 5, 4, 3.5, 3, 2.5, 2, 1.5, 1],
};

/** Entry-count thresholds: places paid = number of thresholds ≤ entries.
 * Index i holds the minimum entry count that pays i+1 places. */
const PLACE_THRESHOLDS: Record<PaybackScheduleId, number[]> = {
  // 1 / 2-5 / 6-9 / 10-13 / 14-18 / 19-24 / 25-28 / 29-32 / 33-36 /
  // 37-40 / 41-44 / 45-48 / 49-52 / 53-60 / 61+
  A: [1, 2, 6, 10, 14, 19, 25, 29, 33, 37, 41, 45, 49, 53, 61],
  // 1 / 2-5 / 6-7 / 8-9 / 10-11 / 12-13 / 14-15 / 16-17 / 18-19 /
  // 20-21 / 22-23 / 24-25 / 26-27 / 28-29 / 30+
  B: [1, 2, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
};

export const PAYBACK_SCHEDULE_LABELS: Record<PaybackScheduleId, string> = {
  A: "Schedule A — all ancillary NRHA classes (except $2,000+ added Category 1)",
  B: "Schedule B — $2,000 or more added Category 1 classes",
};

/** Number of places paid for a given entry count under a schedule. */
export function placesPaid(schedule: PaybackScheduleId, entryCount: number): number {
  if (entryCount < 1) return 0;
  const thresholds = PLACE_THRESHOLDS[schedule];
  let places = 0;
  for (const min of thresholds) {
    if (entryCount >= min) places += 1;
    else break;
  }
  return places;
}

/** Build a payout_schedule (placing → percent rows) from a schedule and
 * entry count. Returns [] for entryCount < 1. */
export function buildPaybackSchedule(
  schedule: PaybackScheduleId,
  entryCount: number
): PayoutScheduleEntry[] {
  const places = placesPaid(schedule, entryCount);
  if (places === 0) return [];
  return PERCENT_ROWS[places].map((percent, i) => ({ placing: i + 1, percent }));
}
