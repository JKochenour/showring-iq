"use client";

import { useState, useTransition } from "react";
import { checkInEntry, undoCheckIn } from "@/app/(app)/shows/[id]/check-in/actions";
import { Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function CheckInButton({
  entryId,
  checkedIn,
  blockingMessages,
}: {
  entryId: string;
  checkedIn: boolean;
  blockingMessages: string[];
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div>
      {checkedIn ? (
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={async () => {
            const result = await confirm({
              title: "Undo check-in",
              message: "Undo check-in for this entry?",
            });
            if (result) run(() => undoCheckIn(entryId));
          }}
        >
          {isPending ? "Working…" : "Undo"}
        </Button>
      ) : (
        <Button
          disabled={isPending}
          onClick={async () => {
            if (blockingMessages.length > 0) {
              const result = await confirm({
                title: "Override blocking issues",
                message: `This entry has blocking issues:\n\n• ${blockingMessages.join(
                  "\n• "
                )}`,
                tone: "danger",
                confirmLabel: "Check in anyway",
                fields: [
                  {
                    name: "reason",
                    label: "Override reason (required)",
                    required: true,
                  },
                ],
              });
              if (!result) return;
              run(() => checkInEntry(entryId, result.reason.trim()));
            } else {
              run(() => checkInEntry(entryId));
            }
          }}
        >
          {isPending ? "Checking in…" : "Check in"}
        </Button>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
