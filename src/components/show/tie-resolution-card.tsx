"use client";

import { useState, useTransition } from "react";
import { resolveTie } from "@/app/(app)/shows/[id]/results/actions";
import { Alert, Button, Card } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

const RESOLUTION_LABEL = {
  co_champions: "Declared co-champions",
  run_off_completed: "Resolved by run-off",
} as const;

export function TieResolutionCard({
  showId,
  classId,
  representativeEntryClassId,
  tiedNames,
  resolution,
  resolutionNote,
  canResolve,
}: {
  showId: string;
  classId: string;
  representativeEntryClassId: string;
  tiedNames: string[];
  resolution: "co_champions" | "run_off_completed" | null;
  resolutionNote: string | null;
  canResolve: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const declare = async (choice: "co_champions" | "run_off_completed") => {
    const result = await confirm({
      title: choice === "co_champions" ? "Declare co-champions" : "Mark run-off completed",
      message:
        choice === "co_champions"
          ? "Records that the tied exhibitors chose to remain co-champions rather than run off. Prize money already splits evenly between them — this just documents the decision."
          : "Records that a run-off happened for this tie. Enter the run-off outcome by using \"Correct\" on each tied entry's score below, then Recalculate — this note just documents that a run-off took place.",
      confirmLabel: "Save",
      fields: [
        {
          name: "note",
          label: "Note (optional — e.g. tiebreaker for the trophy)",
          type: "textarea",
        },
      ],
    });
    if (!result) return;
    setError(undefined);
    startTransition(async () => {
      const actionResult = await resolveTie(
        representativeEntryClassId,
        choice,
        result.note.trim(),
        showId,
        classId
      );
      if (actionResult?.error) setError(actionResult.error);
    });
  };

  return (
    <Card className="border-amber-400 dark:border-amber-600">
      <h3 className="mb-1 text-base font-semibold">Tie for 1st place</h3>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
        {tiedNames.join(", ")} are tied for 1st. Prize money already splits
        evenly between them automatically. Per NRHA rule O, only a 1st-place
        tie may be worked off — the tied exhibitors can agree to run off (same
        pattern, one run-off only) or remain co-champions.
      </p>
      {error && <Alert>{error}</Alert>}
      {resolution ? (
        <Alert tone="success">
          {RESOLUTION_LABEL[resolution]}
          {resolutionNote && ` — ${resolutionNote}`}
        </Alert>
      ) : (
        canResolve && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={() => declare("co_champions")}>
              Declare co-champions
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => declare("run_off_completed")}
            >
              Mark run-off completed
            </Button>
          </div>
        )
      )}
    </Card>
  );
}
