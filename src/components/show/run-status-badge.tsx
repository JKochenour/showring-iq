const STYLES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  at_gate: {
    label: "At gate",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  in_arena: {
    label: "In arena",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  completed: {
    label: "Completed",
    className: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
  hold: {
    label: "Hold",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  no_show: {
    label: "No show",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  scratched: {
    label: "Scratched",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export function RunStatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.pending;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
