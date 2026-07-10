import type { ScoreStatus } from "@/lib/types";

const STYLES: Record<ScoreStatus | "none", { label: string; className: string }> = {
  none: {
    label: "Not scored",
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
  pending: {
    label: "Draft",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  submitted: {
    label: "Submitted",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  verified: {
    label: "Verified",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

export function ScoreStatusBadge({ status }: { status: ScoreStatus | null }) {
  const style = STYLES[status ?? "none"];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
