/**
 * TypeScript mirror of the payout formula in
 * supabase/migrations/00051_fix_tie_payout_split.sql (calculate_payouts).
 *
 * THE MIGRATION IS THE AUTHORITY — the database RPC computes real money.
 * This mirror exists so the formula has unit-test coverage: the tie-split
 * bug fixed in 00051 (each tied entry received its own placing's FULL
 * percentage, over-paying the pool) lived from 00011 to the 15th session
 * precisely because no automated test pinned the tied-money math down.
 * If the SQL formula ever changes, change this file in the same commit.
 */

export interface PayoutScheduleRow {
  placing: number;
  percent: number;
}

/**
 * Pool after retainage, exactly as the RPC computes it:
 * (entered entry fees + added money) × (1 − retainage/100), rounded to a
 * cent. Youth classes never pay retainage (Show Rules P(7) — 00027).
 */
export function payoutPoolCents(
  enteredFeeCents: number,
  addedMoneyCents: number,
  retainagePercent: number,
  isYouth: boolean
): number {
  const retainage = isYouth ? 0 : retainagePercent;
  return Math.round((enteredFeeCents + addedMoneyCents) * (1 - retainage / 100));
}

/**
 * Money per entry for each placing present in the results.
 *
 * `placings` is one number per placed result row — a 2-way tie for 1st is
 * [1, 1, 3, ...] (standard competition ranking, as calculate_results
 * assigns). n entries tied at placing p consume schedule rows p..p+n-1 and
 * split the combined percentage evenly; placings beyond the schedule get 0.
 * Returns a map of placing → cents PER ENTRY at that placing.
 */
export function payoutPerPlacing(
  poolCents: number,
  schedule: PayoutScheduleRow[],
  placings: number[]
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of placings) counts.set(p, (counts.get(p) ?? 0) + 1);

  const out = new Map<number, number>();
  for (const [placing, nTied] of counts) {
    const percentSum = schedule
      .filter((r) => r.placing >= placing && r.placing < placing + nTied)
      .reduce((s, r) => s + r.percent, 0);
    out.set(placing, Math.round((poolCents * percentSum) / 100 / nTied));
  }
  return out;
}

/** Total paid out — must never exceed the pool (allowing cent rounding). */
export function totalPaidCents(
  perPlacing: Map<number, number>,
  placings: number[]
): number {
  return placings.reduce((s, p) => s + (perPlacing.get(p) ?? 0), 0);
}
