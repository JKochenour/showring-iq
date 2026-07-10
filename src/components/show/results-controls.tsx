"use client";

import { useState, useTransition } from "react";
import {
  calculateResults,
  overridePlacing,
  publishResults,
  unpublishResults,
} from "@/app/(app)/shows/[id]/results/actions";
import { Alert, Button } from "@/components/ui";

export function ResultsClassActions({
  classId,
  showId,
  classStatus,
  hasResults,
  canPublish,
  canUnpublish,
}: {
  classId: string;
  showId: string;
  classStatus: string;
  hasResults: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
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
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(classStatus === "official" || classStatus === "results_posted") &&
          canPublish && (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => calculateResults(classId, showId))}
            >
              {isPending ? "Calculating…" : hasResults ? "Recalculate" : "Calculate results"}
            </Button>
          )}
        {classStatus === "official" && hasResults && canPublish && (
          <Button
            disabled={isPending}
            onClick={() => run(() => publishResults(classId, showId))}
          >
            {isPending ? "Posting…" : "Post results"}
          </Button>
        )}
        {classStatus === "results_posted" && canUnpublish && (
          <Button
            variant="danger"
            disabled={isPending}
            onClick={() => {
              if (window.confirm("Unpost these results? The class returns to official."))
                run(() => unpublishResults(classId, showId));
            }}
          >
            {isPending ? "Working…" : "Unpost"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function OverridePlacingButton({
  entryClassId,
  showId,
  classId,
  currentPlacing,
}: {
  entryClassId: string;
  showId: string;
  classId: string;
  currentPlacing: number | null;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          const placingStr = window.prompt(
            "Set placing (whole number):",
            currentPlacing ? String(currentPlacing) : ""
          );
          if (placingStr === null || placingStr.trim() === "") return;
          const placing = parseInt(placingStr, 10);
          if (Number.isNaN(placing)) {
            setError("Enter a whole number.");
            return;
          }
          const reason = window.prompt("Reason for this placing correction (required):");
          if (!reason || reason.trim() === "") return;
          setError(undefined);
          startTransition(async () => {
            const result = await overridePlacing(
              { entryClassId, placing, reason: reason.trim() },
              showId,
              classId
            );
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Saving…" : "Override"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
