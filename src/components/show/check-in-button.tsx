"use client";

import { useState, useTransition } from "react";
import { checkInEntry, undoCheckIn } from "@/app/(app)/shows/[id]/check-in/actions";
import { Button } from "@/components/ui";

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
          onClick={() => {
            if (window.confirm("Undo check-in for this entry?"))
              run(() => undoCheckIn(entryId));
          }}
        >
          {isPending ? "Working…" : "Undo"}
        </Button>
      ) : (
        <Button
          disabled={isPending}
          onClick={() => {
            if (blockingMessages.length > 0) {
              const reason = window.prompt(
                `This entry has blocking issues:\n\n• ${blockingMessages.join(
                  "\n• "
                )}\n\nEnter an override reason to check in anyway (required):`
              );
              if (reason === null) return;
              if (reason.trim() === "") {
                setError("An override reason is required.");
                return;
              }
              run(() => checkInEntry(entryId, reason.trim()));
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
