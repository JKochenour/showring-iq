import type { ShowClass } from "@/lib/types";

/**
 * NRHA Show Rules P(9): judge's score sheets should be available for review
 * within one hour of class completion. Soft reminder only — a class is
 * flagged once it's fully scored, an hour has passed since the last score
 * was entered, and the results still aren't posted.
 *
 * Server-side helper (pages call it during render); "class completion" is
 * approximated by the most recent score update, since class-status
 * transitions aren't individually timestamped.
 */
/**
 * NRHA Show Rules P(5): payout distribution is due 30 days after event
 * completion. Computed server-side so client components stay pure.
 */
export function payoutDeadlineInfo(endDate: string): {
  deadlineLabel: string;
  daysLeft: number;
} {
  const deadline = new Date(`${endDate}T00:00:00`);
  deadline.setDate(deadline.getDate() + 30);
  return {
    deadlineLabel: deadline.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    daysLeft: Math.ceil((deadline.getTime() - Date.now()) / 86_400_000),
  };
}

export function scoreSheetsOverdue(
  cls: Pick<ShowClass, "id" | "status">,
  enteredCount: number,
  scoredCount: number,
  lastScoreAtMs: number | undefined
): boolean {
  if (enteredCount === 0 || scoredCount < enteredCount) return false;
  if (["results_posted", "exported", "archived"].includes(cls.status)) {
    return false;
  }
  return (
    lastScoreAtMs !== undefined && Date.now() - lastScoreAtMs > 60 * 60 * 1000
  );
}
