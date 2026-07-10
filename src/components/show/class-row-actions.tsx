"use client";

import { useState, useTransition } from "react";
import {
  deleteClass,
  moveClass,
} from "@/app/(app)/shows/[id]/classes/actions";
import { Button } from "@/components/ui";

export function ReorderButtons({
  classId,
  isFirst,
  isLast,
}: {
  classId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const move = (direction: "up" | "down") => {
    setError(undefined);
    startTransition(async () => {
      const result = await moveClass(classId, direction);
      if (result?.error) setError(result.error);
    });
  };

  const btn =
    "rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

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

export function DeleteClassButton({
  classId,
  label,
}: {
  classId: string;
  label: string;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (
            !window.confirm(
              `Permanently delete ${label}? This cannot be undone.`
            )
          )
            return;
          setError(undefined);
          startTransition(async () => {
            const result = await deleteClass(classId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Deleting…" : "Delete class"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
