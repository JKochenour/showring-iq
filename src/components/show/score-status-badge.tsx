import type { ScoreStatus } from "@/lib/types";

const STYLES: Record<ScoreStatus | "none", { label: string; className: string }> = {
  none: {
    label: "Not scored",
    className: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
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
      "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
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
