"use client";

import { useState, useTransition } from "react";
import {
  markClassOfficial,
  markClassScoringComplete,
} from "@/app/(app)/shows/[id]/scoring/actions";
import { Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function ClassScoringActions({
  classId,
  showId,
  classStatus,
  canVerify,
  canFinalize,
}: {
  classId: string;
  showId: string;
  classStatus: string;
  canVerify: boolean;
  canFinalize: boolean;
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
      <div className="flex flex-wrap gap-2">
        {["draw_posted", "in_progress", "scoring"].includes(classStatus) &&
          canVerify && (
            <Button
              disabled={isPending}
              onClick={() => run(() => markClassScoringComplete(classId, showId))}
            >
              {isPending ? "Working…" : "Mark scoring complete"}
            </Button>
          )}
        {classStatus === "pending_verification" && canFinalize && (
          <Button
            disabled={isPending}
            onClick={async () => {
              const result = await confirm({
                title: "Mark class official",
                message: "Mark this class official? Results can be posted next.",
                confirmLabel: "Mark official",
              });
              if (result) run(() => markClassOfficial(classId, showId));
            }}
          >
            {isPending ? "Working…" : "Mark official"}
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
