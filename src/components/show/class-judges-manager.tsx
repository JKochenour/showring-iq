"use client";

import { useState, useTransition } from "react";
import {
  assignClassJudge,
  unassignClassJudge,
} from "@/app/(app)/shows/[id]/classes/actions";
import { Button, Card } from "@/components/ui";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import type { ClassJudgeRow } from "@/lib/types";

export function ClassJudgesManager({
  classId,
  assignments,
  judgeOptions,
  editable,
}: {
  classId: string;
  assignments: ClassJudgeRow[];
  judgeOptions: ComboboxOption[];
  editable: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const assignedStaffIds = new Set(assignments.map((a) => a.show_staff_id));
  const availableOptions = judgeOptions.filter((o) => !assignedStaffIds.has(o.id));

  const onAssign = () => {
    if (!selected) return;
    setError(undefined);
    startTransition(async () => {
      const result = await assignClassJudge(classId, selected);
      if (result?.error) setError(result.error);
      else setSelected("");
    });
  };

  const onRemove = (classJudgeId: string, label: string) => {
    if (!window.confirm(`Remove ${label} as judge for this class?`)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await unassignClassJudge(classJudgeId);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold">Assigned judges</h3>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        Only judges assigned here can enter scores for this class (office
        staff with score correction access can still enter/correct for
        anyone).
      </p>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {assignments.length === 0 ? (
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          No judges assigned yet.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-stone-200 dark:divide-stone-800">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">
                  {a.show_staff?.display_name ?? "Unknown"}
                </p>
                {!a.show_staff?.user_id && (
                  <p className="text-xs text-stone-400">Not a platform user</p>
                )}
              </div>
              {editable && (
                <Button
                  variant="danger"
                  disabled={isPending}
                  onClick={() =>
                    onRemove(a.id, a.show_staff?.display_name ?? "this judge")
                  }
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Combobox
              options={availableOptions}
              value={selected}
              onChange={setSelected}
              placeholder="Select a judge…"
              emptyText="No judges on show staff — add one under Staff first"
              clearable
            />
          </div>
          <Button disabled={!selected || isPending} onClick={onAssign}>
            {isPending ? "Assigning…" : "Assign judge"}
          </Button>
        </div>
      )}
    </Card>
  );
}
