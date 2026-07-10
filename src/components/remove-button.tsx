"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

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

  return (
    <div>
      <Button
        variant={variant}
        disabled={isPending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
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
