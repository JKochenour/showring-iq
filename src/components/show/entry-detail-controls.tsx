"use client";

import { useState, useTransition } from "react";
import {
  addEntryClass,
  assignBackNumber,
  reinstateEntry,
  reinstateEntryClass,
  releaseBackNumber,
  scratchEntry,
  scratchEntryClass,
  setEntryBillToTrainer,
} from "@/app/(app)/shows/[id]/entries/actions";
import { Alert, Button, Input, Select } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function BillToTrainerToggle({
  entryId,
  trainerName,
  billToTrainer,
  canEdit,
}: {
  entryId: string;
  trainerName: string | null;
  billToTrainer: boolean;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  if (!trainerName) return null;

  const toggle = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await setEntryBillToTrainer(entryId, !billToTrainer);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-stone-300 accent-brand-700"
          checked={billToTrainer}
          disabled={!canEdit || isPending}
          onChange={toggle}
        />
        Bill entry fees and charges to trainer ({trainerName}) instead of
        owner/rider
      </label>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function BackNumberControl({
  entryId,
  currentNumber,
  canAssign,
}: {
  entryId: string;
  currentNumber: number | null;
  canAssign: boolean;
}) {
  const [error, setError] = useState<string>();
  const [manual, setManual] = useState("");
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else setManual("");
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-stone-900 px-3 py-1.5 font-mono text-lg font-bold text-white dark:bg-stone-100 dark:text-stone-900">
          {currentNumber ? `#${currentNumber}` : "—"}
        </span>
        {canAssign && (
          <>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => assignBackNumber(entryId))}
            >
              {currentNumber ? "Reassign next" : "Auto-assign"}
            </Button>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={9999}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Set #"
                className="w-24"
              />
              <Button
                variant="secondary"
                disabled={isPending || manual.trim() === ""}
                onClick={() =>
                  run(() => assignBackNumber(entryId, parseInt(manual, 10)))
                }
              >
                Set
              </Button>
            </div>
            {currentNumber && (
              <Button
                variant="danger"
                disabled={isPending}
                onClick={async () => {
                  const result = await confirm({
                    title: "Release back number",
                    message: `Release back number ${currentNumber}?`,
                    tone: "danger",
                    confirmLabel: "Release",
                  });
                  if (result) run(() => releaseBackNumber(entryId));
                }}
              >
                Release
              </Button>
            )}
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function AddEntryClassForm({
  entryId,
  availableClasses,
}: {
  entryId: string;
  availableClasses: { id: string; label: string }[];
}) {
  const [error, setError] = useState<string>();
  const [classId, setClassId] = useState("");
  const [isPending, startTransition] = useTransition();

  if (availableClasses.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-72"
        >
          <option value="">Add a class…</option>
          {availableClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          disabled={isPending || !classId}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              const result = await addEntryClass({ entryId, classId });
              if (result?.error) setError(result.error);
              else setClassId("");
            });
          }}
        >
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function ScratchClassButton({
  entryClassId,
  canScratch,
  canReinstate,
  status,
}: {
  entryClassId: string;
  canScratch: boolean;
  canReinstate: boolean;
  status: "entered" | "scratched";
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  if (status === "entered" && !canScratch) return null;
  if (status === "scratched" && !canReinstate) return null;

  return (
    <div>
      <Button
        variant={status === "entered" ? "danger" : "secondary"}
        disabled={isPending}
        onClick={async () => {
          setError(undefined);
          if (status === "entered") {
            const result = await confirm({
              title: "Scratch class",
              message: "Scratch this class from the entry?",
              tone: "danger",
              confirmLabel: "Scratch",
              fields: [{ name: "reason", label: "Reason (optional)" }],
            });
            if (!result) return;
            startTransition(async () => {
              const scratchResult = await scratchEntryClass(entryClassId, result.reason);
              if (scratchResult?.error) setError(scratchResult.error);
            });
          } else {
            startTransition(async () => {
              const result = await reinstateEntryClass(entryClassId);
              if (result?.error) setError(result.error);
            });
          }
        }}
      >
        {isPending
          ? "Working…"
          : status === "entered"
            ? "Scratch"
            : "Reinstate"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function EntryScratchControls({
  entryId,
  status,
  canScratch,
  canReinstate,
}: {
  entryId: string;
  status: "active" | "scratched";
  canScratch: boolean;
  canReinstate: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  if (status === "active" && !canScratch) return null;
  if (status === "scratched" && !canReinstate) return null;

  return (
    <div>
      {error && (
        <div className="mb-2">
          <Alert>{error}</Alert>
        </div>
      )}
      {status === "active" ? (
        <Button
          variant="danger"
          disabled={isPending}
          onClick={async () => {
            const confirmResult = await confirm({
              title: "Scratch entire entry",
              message: "Scratch the entire entry (all classes)?",
              tone: "danger",
              confirmLabel: "Scratch",
              fields: [{ name: "reason", label: "Reason (optional)" }],
            });
            if (!confirmResult) return;
            setError(undefined);
            startTransition(async () => {
              const result = await scratchEntry(entryId, confirmResult.reason);
              if (result?.error) setError(result.error);
            });
          }}
        >
          {isPending ? "Scratching…" : "Scratch entire entry"}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              const result = await reinstateEntry(entryId);
              if (result?.error) setError(result.error);
            });
          }}
        >
          {isPending ? "Reinstating…" : "Reinstate entry"}
        </Button>
      )}
    </div>
  );
}
