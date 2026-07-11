"use client";

import { useState, useTransition } from "react";
import { setRunStatus } from "@/app/(app)/shows/[id]/draws/actions";

const ACTIONS: {
  status: string;
  label: string;
  tone: "primary" | "neutral" | "warn" | "danger";
  promptReason?: boolean;
  confirm?: string;
}[] = [
  { status: "at_gate", label: "At gate", tone: "neutral" },
  { status: "in_arena", label: "In arena", tone: "primary" },
  { status: "completed", label: "Done", tone: "neutral" },
  { status: "hold", label: "Hold", tone: "warn", promptReason: true },
  { status: "no_show", label: "No show", tone: "warn", promptReason: true },
  {
    status: "scratched",
    label: "Scratch",
    tone: "danger",
    promptReason: true,
    confirm: "Scratch this run? The class entry is scratched too.",
  },
];

const TONE_STYLES: Record<string, string> = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 border-brand-700",
  neutral:
    "border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800",
  warn: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  danger:
    "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

export function GateActionButtons({
  rowId,
  currentStatus,
}: {
  rowId: string;
  currentStatus: string;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const run = (status: string, reason?: string) => {
    setError(undefined);
    startTransition(async () => {
      const result = await setRunStatus(rowId, status, reason);
      if (result?.error) setError(result.error);
    });
  };

  const isFinal = ["completed", "no_show", "scratched"].includes(currentStatus);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.filter((a) => a.status !== currentStatus).map((action) => (
          <button
            key={action.status}
            disabled={isPending}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${TONE_STYLES[action.tone]}`}
            onClick={() => {
              if (action.confirm && !window.confirm(action.confirm)) return;
              if (action.promptReason) {
                const reason = window.prompt(
                  `${action.label} — reason (optional):`
                );
                if (reason === null) return;
                run(action.status, reason);
              } else {
                run(action.status);
              }
            }}
          >
            {action.label}
          </button>
        ))}
        {isFinal && (
          <button
            disabled={isPending}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${TONE_STYLES.neutral}`}
            onClick={() => run("pending")}
          >
            Reset
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
