"use client";

import { useState, useTransition } from "react";
import { updatePointsSchedule } from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { Alert, Button, Input } from "@/components/ui";

interface PointsRow {
  placing: number;
  points: number;
}

export function PointsScheduleEditor({
  organizationId,
  rulePackageId,
  schedule,
  canEdit,
}: {
  organizationId: string;
  rulePackageId: string;
  schedule: PointsRow[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<PointsRow[]>(schedule);

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePointsSchedule(
        {
          rulePackageId,
          schedule: rows.map((r) => ({
            placing: Number(r.placing),
            points: Number(r.points),
          })),
        },
        organizationId
      );
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Points schedule saved.</Alert>}
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Converts a placing into standings points, used by Standings for
        classes flagged &quot;counts for year-end.&quot; Org-configured — not
        an official association formula unless you enter one. Blank = every
        placing is worth 0 points.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              className="w-20"
              value={row.placing}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], placing: Number(e.target.value) };
                setRows(next);
              }}
            />
            <span className="text-sm text-stone-500">place →</span>
            <Input
              type="number"
              min={0}
              step="0.5"
              className="w-24"
              value={row.points}
              disabled={!canEdit}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], points: Number(e.target.value) };
                setRows(next);
              }}
            />
            <span className="text-sm text-stone-500">points</span>
            {canEdit && (
              <Button
                variant="secondary"
                onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setRows([...rows, { placing: rows.length + 1, points: 0 }])}
          >
            Add row
          </Button>
          <Button disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save points schedule"}
          </Button>
        </div>
      )}
    </div>
  );
}
