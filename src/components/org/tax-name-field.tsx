"use client";

import { useState, useTransition } from "react";
import { updateTaxName } from "@/app/(app)/organizations/[id]/people/actions";
import { Alert, Button, Input, Label } from "@/components/ui";

export function TaxNameField({
  personId,
  organizationId,
  taxName,
  canEdit,
}: {
  personId: string;
  organizationId: string;
  taxName: string | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(taxName ?? "");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateTaxName(personId, organizationId, value);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-2">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="tax-name">Legal name for 1099 (optional)</Label>
          <Input
            id="tax-name"
            placeholder="Defaults to first/last name"
            className="w-64"
            value={value}
            disabled={!canEdit}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button variant="secondary" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        The tax ID itself is never stored here — upload a signed W-9 in
        Documents below (type &quot;W-9&quot;) instead.
      </p>
    </div>
  );
}
