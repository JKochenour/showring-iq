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
