import { formatCents } from "@/lib/money";
import type { ValidationIssue } from "@/lib/validation-engine";

export interface FeeCapConfig {
  code: string;
  name: string;
  max_added_money_cents: number | null;
  max_entry_fee_cents: number | null;
  max_entry_fee_percent_of_added_money: number | null;
  max_entry_fee_jackpot_cents: number | null;
}

/** Soft warnings when a class's configured fee/added money exceeds the
 * caps configured on its linked rule-package class code (Show Rules
 * H/I/J/K/L fee-cap tables). Not enforced — show management retains
 * final judgment, same disclaimer used everywhere else in this app. */
export function computeFeeCapIssues(
  entryFeeCents: number,
  addedMoneyCents: number,
  cap: FeeCapConfig | null
): ValidationIssue[] {
  if (!cap) return [];
  const issues: ValidationIssue[] = [];

  if (cap.max_added_money_cents !== null && addedMoneyCents > cap.max_added_money_cents) {
    issues.push({
      code: "fee_cap.added_money",
      severity: "warning",
      message: `Added money ${formatCents(addedMoneyCents)} exceeds the ${formatCents(cap.max_added_money_cents)} cap configured for ${cap.code} — ${cap.name}.`,
    });
  }

  const isJackpot = addedMoneyCents === 0;
  let entryFeeCap: number | null = null;
  if (isJackpot && cap.max_entry_fee_jackpot_cents !== null) {
    entryFeeCap = cap.max_entry_fee_jackpot_cents;
  } else if (cap.max_entry_fee_percent_of_added_money !== null) {
    entryFeeCap = Math.round(
      (addedMoneyCents * cap.max_entry_fee_percent_of_added_money) / 100
    );
  } else if (cap.max_entry_fee_cents !== null) {
    entryFeeCap = cap.max_entry_fee_cents;
  }

  if (entryFeeCap !== null && entryFeeCents > entryFeeCap) {
    issues.push({
      code: "fee_cap.entry_fee",
      severity: "warning",
      message: `Entry fee ${formatCents(entryFeeCents)} exceeds the ${formatCents(entryFeeCap)} cap configured for ${cap.code} — ${cap.name}.`,
    });
  }

  return issues;
}
