import type { ClassStatus } from "@/lib/types";

const LABELS: Record<ClassStatus, string> = {
  draft: "Draft",
  open: "Open",
  entry_closed: "Entry closed",
  draw_posted: "Draw posted",
  in_progress: "In progress",
  scoring: "Scoring",
  pending_verification: "Pending verification",
  official: "Official",
  results_posted: "Results posted",
  exported: "Exported",
  archived: "Archived",
  cancelled: "Cancelled",
};

export function ClassStatusBadge({ status }: { status: ClassStatus }) {
  const tone =
    status === "open"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "cancelled"
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        : status === "draft"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
