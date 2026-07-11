"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

/** Generic destructive-action button. Pass a pre-bound server action. */
export function RemoveButton({
  action,
  label = "Remove",
  pendingLabel = "Removing…",
  confirmText,
  variant = "danger",
}: {
  action: () => Promise<{ error?: string }>;
  label?: string;
  pendingLabel?: string;
  confirmText?: string;
  variant?: "danger" | "secondary";
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  return (
    <div>
      <Button
        variant={variant}
        disabled={isPending}
        onClick={async () => {
          if (confirmText) {
            const result = await confirm({
              title: label,
              message: confirmText,
              tone: "danger",
              confirmLabel: label,
            });
            if (!result) return;
          }
          setError(undefined);
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? pendingLabel : label}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
