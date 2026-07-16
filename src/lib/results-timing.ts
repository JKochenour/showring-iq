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

/**
 * Close-out deadline (e.g. EPRHA's "bills must be closed out before noon
 * Sunday, $50 fee after"). Computed server-side so client components
 * stay pure.
 */
/**
 * shows.close_out_deadline is saved from a naive datetime-local string
 * (00036), so Postgres stores the office's WALL CLOCK in the UTC
 * fields. Format those fields as-is (timeZone: "UTC") so the label
 * matches what was typed, and derive the real instant by interpreting
 * that wall clock in the show's timezone.
 */
export function closeOutDeadlineInfo(
  deadlineIso: string,
  showTimezone: string
): {
  deadlineLabel: string;
  passed: boolean;
} {
  const wallClock = new Date(deadlineIso);
  const deadlineLabel = wallClock.toLocaleString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // The instant at which this wall clock occurs in the show's timezone:
  // shift by that zone's UTC offset (DST-correct for the deadline date).
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: showTimezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(wallClock)
      .map((p) => [p.type, p.value])
  );
  const zoneAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const offsetMs = zoneAsUtc - wallClock.getTime();
  const instantMs = wallClock.getTime() - offsetMs;

  return { deadlineLabel, passed: Date.now() >= instantMs };
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
