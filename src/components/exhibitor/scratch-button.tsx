"use client";

import { useState, useTransition } from "react";
import { exhibitorScratchEntryClass } from "@/app/(exhibitor)/exhibitor/[orgId]/actions";
import { Button } from "@/components/ui";

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

  return (
    <div>
      <Button
        type="button"
        variant="danger"
        className="px-2 py-1 text-xs"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Scratch ${label}?`)) return;
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
