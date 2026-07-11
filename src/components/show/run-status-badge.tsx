const STYLES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  },
  at_gate: {
    label: "At gate",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  in_arena: {
    label: "In arena",
    className:
      "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
  },
  completed: {
    label: "Completed",
    className: "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
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
