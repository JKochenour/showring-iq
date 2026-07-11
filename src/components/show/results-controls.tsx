"use client";

import { useState, useTransition } from "react";
import {
  calculateResults,
  overridePlacing,
  publishResults,
  unpublishResults,
} from "@/app/(app)/shows/[id]/results/actions";
import { Alert, Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

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
            onClick={async () => {
              const result = await confirm({
                title: "Unpost results",
                message: "Unpost these results? The class returns to official.",
                tone: "danger",
                confirmLabel: "Unpost",
              });
              if (result) run(() => unpublishResults(classId, showId));
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
  const confirm = useConfirmDialog();

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={async () => {
          const result = await confirm({
            title: "Override placing",
            tone: "danger",
            confirmLabel: "Save",
            fields: [
              {
                name: "placing",
                label: "Placing (whole number)",
                defaultValue: currentPlacing ? String(currentPlacing) : "",
                required: true,
              },
              {
                name: "reason",
                label: "Reason (required)",
                type: "textarea",
                required: true,
              },
            ],
          });
          if (!result) return;
          const placing = parseInt(result.placing, 10);
          if (Number.isNaN(placing)) {
            setError("Enter a whole number.");
            return;
          }
          setError(undefined);
          startTransition(async () => {
            const actionResult = await overridePlacing(
              { entryClassId, placing, reason: result.reason.trim() },
              showId,
              classId
            );
            if (actionResult?.error) setError(actionResult.error);
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
