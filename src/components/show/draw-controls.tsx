"use client";

import { useState, useTransition } from "react";
import {
  appendToDraw,
  generateDraw,
  moveDrawRow,
  removeFromDraw,
} from "@/app/(app)/shows/[id]/draws/actions";
import { Button, Input, Label } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function GenerateDrawButton({
  classId,
  hasExistingDraw,
}: {
  classId: string;
  hasExistingDraw: boolean;
}) {
  const [error, setError] = useState<string>();
  const [seed, setSeed] = useState("");
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="draw-seed">Seed (optional, for reproducibility)</Label>
          <Input
            id="draw-seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="random"
            className="w-40"
          />
        </div>
        <Button
          disabled={isPending}
          onClick={async () => {
            if (hasExistingDraw) {
              const result = await confirm({
                title: "Re-draw class",
                message:
                  "Re-draw this class? The existing order is replaced and the re-draw is recorded in the audit log.",
                tone: "danger",
                confirmLabel: "Re-draw",
              });
              if (!result) return;
            }
            setError(undefined);
            startTransition(async () => {
              const result = await generateDraw(classId, seed || undefined);
              if (result?.error) setError(result.error);
              else setSeed("");
            });
          }}
        >
          {isPending
            ? "Drawing…"
            : hasExistingDraw
              ? "Re-draw"
              : "Generate draw"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Seeded shuffle with back-to-back rider spacing (best effort).
      </p>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function DrawMoveButtons({
  rowId,
  isFirst,
  isLast,
}: {
  rowId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const move = (direction: "up" | "down") => {
    setError(undefined);
    startTransition(async () => {
      const result = await moveDrawRow(rowId, direction);
      if (result?.error) setError(result.error);
    });
  };

  const btn =
    "rounded border border-stone-300 px-1.5 py-0.5 text-xs text-stone-600 hover:bg-stone-100 disabled:opacity-40 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800";

  return (
    <div className="flex flex-col gap-1" title={error}>
      <button
        className={btn}
        disabled={isFirst || isPending}
        onClick={() => move("up")}
        aria-label="Move up"
      >
        ▲
      </button>
      <button
        className={btn}
        disabled={isLast || isPending}
        onClick={() => move("down")}
        aria-label="Move down"
      >
        ▼
      </button>
    </div>
  );
}

export function AppendToDrawButton({ entryClassId }: { entryClassId: string }) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await appendToDraw(entryClassId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Adding…" : "Add to end of draw"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function RemoveFromDrawButton({ rowId }: { rowId: string }) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  return (
    <div>
      <Button
        variant="danger"
        disabled={isPending}
        onClick={async () => {
          const result = await confirm({
            title: "Remove from draw",
            message: "Remove this run from the draw?",
            tone: "danger",
            confirmLabel: "Remove",
          });
          if (!result) return;
          setError(undefined);
          startTransition(async () => {
            const result = await removeFromDraw(rowId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Removing…" : "Remove"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
