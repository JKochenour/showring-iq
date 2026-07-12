"use client";

import { useState, useTransition } from "react";
import { enterJudgeScore } from "@/app/(app)/shows/[id]/scoring/actions";
import { formatScore, tenthsToInput } from "@/lib/score";
import { Alert, Button, Input } from "@/components/ui";

export interface AssignedJudge {
  id: string;
  name: string;
}

export interface JudgeScoreRow {
  judgeStaffId: string;
  totalScoreTenths: number;
}

/** Per-run entry for classes with 2+ assigned judges (class_judges).
 * Each judge's score is recorded independently via enter_judge_score;
 * the RPC computes the official composite (average) once every
 * assigned judge has recorded one, at which point the parent scores
 * row exists and this run switches to the ordinary ScoreEntryRow on
 * next load. */
export function MultiJudgeScoreEntry({
  entryClassId,
  judges,
  recorded,
  canEnter,
}: {
  entryClassId: string;
  judges: AssignedJudge[];
  recorded: JudgeScoreRow[];
  canEnter: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const recordedByJudge = new Map(recorded.map((r) => [r.judgeStaffId, r.totalScoreTenths]));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(judges.map((j) => [j.id, tenthsToInput(recordedByJudge.get(j.id))]))
  );

  const save = (judgeStaffId: string) => {
    setError(undefined);
    startTransition(async () => {
      const result = await enterJudgeScore({
        entryClassId,
        judgeStaffId,
        totalScore: values[judgeStaffId] ?? "",
        penaltyPoints: "0",
      });
      if (result?.error) setError(result.error);
    });
  };

  const allRecorded = judges.every((j) => recordedByJudge.has(j.id));
  const preview = allRecorded
    ? Math.round(
        judges.reduce((sum, j) => sum + (recordedByJudge.get(j.id) ?? 0), 0) / judges.length
      )
    : null;

  return (
    <div className="rounded-md border border-stone-200 p-3 dark:border-stone-800">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
        {judges.length} judges — average becomes the official score
      </p>
      {error && (
        <div className="mb-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="space-y-2">
        {judges.map((j) => {
          const isRecorded = recordedByJudge.has(j.id);
          return (
            <div key={j.id} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-sm">{j.name}</span>
              <Input
                className="w-24"
                placeholder="70.0"
                value={values[j.id] ?? ""}
                disabled={!canEnter}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [j.id]: e.target.value }))
                }
              />
              {canEnter && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending || !values[j.id]?.trim()}
                  onClick={() => save(j.id)}
                >
                  {isRecorded ? "Update" : "Save"}
                </Button>
              )}
              {isRecorded && (
                <span className="text-xs text-green-700 dark:text-green-400">recorded</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        {allRecorded
          ? `All judges in — official score: ${formatScore(preview)}.`
          : `${judges.length - judges.filter((j) => recordedByJudge.has(j.id)).length} judge(s) still to score. Not official until all are in.`}
      </p>
    </div>
  );
}
