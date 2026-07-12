"use client";

import { useState, useTransition } from "react";
import {
  correctScore,
  enterScore,
  reopenScore,
  submitScore,
  verifyScore,
} from "@/app/(app)/shows/[id]/scoring/actions";
import { formatScore, tenthsToInput } from "@/lib/score";
import { RESULT_STATUS_OPTIONS } from "@/lib/validation/score";
import { Alert, Button, Input, Select } from "@/components/ui";
import { ScoreStatusBadge } from "@/components/show/score-status-badge";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { ResultStatus, Score } from "@/lib/types";

export interface JudgeOption {
  id: string;
  label: string;
}

export function ScoreEntryRow({
  entryClassId,
  score,
  judges,
  canEnter,
  canVerify,
  canCorrectUnofficial,
  canCorrectOfficial,
}: {
  entryClassId: string;
  score: Score | null;
  judges: JudgeOption[];
  canEnter: boolean;
  canVerify: boolean;
  canCorrectUnofficial: boolean;
  canCorrectOfficial: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!score);
  const confirm = useConfirmDialog();

  const [resultStatus, setResultStatus] = useState<ResultStatus>(
    score?.result_status ?? "shown"
  );
  const [totalScore, setTotalScore] = useState(
    tenthsToInput(score?.total_score_tenths)
  );
  const [penaltyPoints, setPenaltyPoints] = useState(
    tenthsToInput(score?.penalty_points_tenths) || "0"
  );
  const [judgeStaffId, setJudgeStaffId] = useState(score?.judge_staff_id ?? "");
  const [notes, setNotes] = useState(score?.notes ?? "");

  const status = score?.status ?? null;
  const canCorrectNow =
    status === "verified" ? canCorrectOfficial : canCorrectUnofficial;

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  };

  if (!editing && score) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-semibold">
            {score.result_status === "shown"
              ? formatScore(score.total_score_tenths)
              : RESULT_STATUS_OPTIONS.find(
                  (r) => r.value === score.result_status
                )?.label}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {score.judge_name && `Judge: ${score.judge_name} · `}
            {score.penalty_points_tenths > 0 &&
              `${formatScore(score.penalty_points_tenths)} penalty · `}
            {score.notes}
          </p>
          {score.signature_name && score.signed_at && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Signed by {score.signature_name} at{" "}
              {new Date(score.signed_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScoreStatusBadge status={score.status} />
          {status === "pending" && canEnter && (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={async () => {
                const result = await confirm({
                  title: "Sign and submit score card",
                  message: "Type your full name to certify this card is accurate.",
                  confirmLabel: "Sign & submit",
                  fields: [
                    {
                      name: "signature",
                      label: "Full name",
                      defaultValue: score.judge_name ?? "",
                      required: true,
                    },
                  ],
                });
                if (!result) return;
                run(() => submitScore(entryClassId, result.signature.trim()));
              }}
            >
              {isPending ? "…" : "Submit"}
            </Button>
          )}
          {status === "submitted" && canVerify && (
            <Button
              disabled={isPending}
              onClick={() => run(() => verifyScore(entryClassId))}
            >
              {isPending ? "…" : "Verify"}
            </Button>
          )}
          {(status === "submitted" || status === "verified") && (
            <Button
              variant="secondary"
              disabled={
                isPending ||
                !(status === "submitted" ? canEnter || canVerify : canVerify)
              }
              onClick={async () => {
                const result = await confirm({
                  title: "Reopen score",
                  message: "Reopen this score for editing?",
                  tone: "danger",
                  confirmLabel: "Reopen",
                  fields: [{ name: "reason", label: "Reason", required: true }],
                });
                if (!result) return;
                run(() => reopenScore(entryClassId, result.reason.trim()));
              }}
            >
              Reopen
            </Button>
          )}
          {canCorrectNow && (
            <Button variant="danger" onClick={() => setEditing(true)}>
              Correct
            </Button>
          )}
        </div>
        {error && (
          <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  const isCorrection = !!score;

  return (
    <div className="space-y-2">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-2 sm:grid-cols-[1fr_110px_110px_1fr]">
        <Select
          value={resultStatus}
          onChange={(e) => setResultStatus(e.target.value as ResultStatus)}
        >
          {RESULT_STATUS_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Score"
          disabled={resultStatus !== "shown"}
          value={resultStatus === "shown" ? totalScore : ""}
          onChange={(e) => setTotalScore(e.target.value)}
        />
        <Input
          placeholder="Penalty"
          value={penaltyPoints}
          onChange={(e) => setPenaltyPoints(e.target.value)}
        />
        <Select
          value={judgeStaffId}
          onChange={(e) => setJudgeStaffId(e.target.value)}
        >
          <option value="">Judge…</option>
          {judges.map((j) => (
            <option key={j.id} value={j.id}>
              {j.label}
            </option>
          ))}
        </Select>
      </div>
      <Input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isPending}
          onClick={async () => {
            if (isCorrection) {
              const result = await confirm({
                title: "Correct this score",
                tone: "danger",
                confirmLabel: "Save correction",
                message:
                  "NRHA Show Rules P(10): corrections to a judge's score sheet " +
                  "cannot be made once the judge leaves the grounds. Corrections " +
                  "due to inputting errors may be made at any time.",
                fields: [
                  {
                    name: "correctionType",
                    label: "Correction type",
                    type: "select",
                    defaultValue: "data_entry_correction",
                    options: [
                      { value: "data_entry_correction", label: "Data entry correction" },
                      { value: "judge_sheet_correction", label: "Judge sheet correction" },
                    ],
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
              run(() =>
                correctScore({
                  entryClassId,
                  resultStatus,
                  totalScore,
                  penaltyPoints,
                  judgeStaffId,
                  notes,
                  correctionType: result.correctionType as
                    | "judge_sheet_correction"
                    | "data_entry_correction",
                  reason: result.reason.trim(),
                })
              );
            } else {
              run(() =>
                enterScore({
                  entryClassId,
                  resultStatus,
                  totalScore,
                  penaltyPoints,
                  judgeStaffId,
                  notes,
                })
              );
            }
          }}
        >
          {isPending ? "Saving…" : isCorrection ? "Save correction" : "Save"}
        </Button>
        {isCorrection && (
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
