"use client";

import { useState, useTransition } from "react";
import { updateEventClassification } from "@/app/(app)/shows/actions";
import {
  EVENT_CLASSIFICATIONS,
  type EventClassification,
} from "@/lib/nrha-event-classification";
import { Alert, Button, Label, Select } from "@/components/ui";

export function ClassificationSelect({
  showId,
  classification,
  canEdit,
}: {
  showId: string;
  classification: EventClassification | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState<string>(classification ?? "");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateEventClassification({
        showId,
        classification: value === "" ? null : (value as EventClassification),
      });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-2">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Classification saved.</Alert>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="event-classification">Declared classification</Label>
          <Select
            id="event-classification"
            value={value}
            disabled={!canEdit}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Not declared</option>
            {EVENT_CLASSIFICATIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        {canEdit && (
          <Button variant="secondary" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
