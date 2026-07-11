"use client";

import { useState, useTransition } from "react";
import { exhibitorScratchEntryClass } from "@/app/(exhibitor)/exhibitor/[orgId]/actions";
import { Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function ExhibitorScratchButton({
  entryClassId,
  organizationId,
  label,
}: {
  entryClassId: string;
  organizationId: string;
  label: string;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  return (
    <div>
      <Button
        type="button"
        variant="danger"
        className="px-2 py-1 text-xs"
        disabled={isPending}
        onClick={async () => {
          const result = await confirm({
            title: "Scratch entry",
            message: `Scratch ${label}?`,
            tone: "danger",
            confirmLabel: "Scratch",
          });
          if (!result) return;
          setError(undefined);
          startTransition(async () => {
            const result = await exhibitorScratchEntryClass(entryClassId, organizationId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "…" : "Scratch"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
