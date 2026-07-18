"use client";

import { useState, useTransition } from "react";
import { deleteShow, setShowStatus } from "@/app/(app)/shows/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { ShowStatus } from "@/lib/types";

export function ShowStatusActions({
  showId,
  organizationId,
  status,
  canPublish,
  canLock,
  canArchive,
  canDelete,
}: {
  showId: string;
  organizationId: string;
  status: ShowStatus;
  canPublish: boolean;
  canLock: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string>();
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockHint, setUnlockHint] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const transition = (next: ShowStatus, reason?: string) => {
    setError(undefined);
    startTransition(async () => {
      const result = await setShowStatus(showId, next, reason);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl">
      <h2 className="mb-1 text-base font-semibold">Status &amp; lifecycle</h2>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        Current status: <StatusBadge status={status} />
      </p>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {status === "draft" && canPublish && (
          <Button disabled={isPending} onClick={() => transition("published")}>
            Publish show
          </Button>
        )}
        {status === "published" && canPublish && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => transition("draft")}
          >
            Unpublish (back to draft)
          </Button>
        )}
        {status === "published" && canLock && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={async () => {
              const result = await confirm({
                title: "Lock show",
                message: "Lock this show? Editing is blocked until it is unlocked.",
                confirmLabel: "Lock",
              });
              if (result) transition("locked");
            }}
          >
            Lock show
          </Button>
        )}
        {/* The reason is required (it goes in the audit log), but a
            greyed-out button with no explanation reads as "this show
            can't be unlocked". So the button stays live and says why
            when it can't proceed. */}
        {status === "locked" && canLock && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="unlock-reason">Unlock reason (required)</Label>
              <Input
                id="unlock-reason"
                value={unlockReason}
                onChange={(e) => {
                  setUnlockReason(e.target.value);
                  if (unlockHint) setUnlockHint(undefined);
                }}
                placeholder="Why is this show being unlocked?"
                className="w-72"
              />
              {unlockHint && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {unlockHint}
                </p>
              )}
            </div>
            <Button
              disabled={isPending}
              onClick={() => {
                if (unlockReason.trim().length === 0) {
                  setUnlockHint(
                    "Type a reason first — it is recorded in the audit log."
                  );
                  document.getElementById("unlock-reason")?.focus();
                  return;
                }
                setUnlockHint(undefined);
                transition("published", unlockReason.trim());
              }}
            >
              Unlock show
            </Button>
          </div>
        )}
        {status !== "archived" && canArchive && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={async () => {
              const result = await confirm({
                title: "Archive show",
                message: "Archive this show?",
                confirmLabel: "Archive",
              });
              if (result) transition("archived");
            }}
          >
            Archive
          </Button>
        )}
        {status === "archived" && canArchive && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => transition("draft")}
          >
            Restore to draft
          </Button>
        )}
        {status === "draft" && canDelete && (
          <Button
            variant="danger"
            disabled={isPending}
            onClick={async () => {
              const result = await confirm({
                title: "Delete show",
                message: "Permanently delete this draft show? This cannot be undone.",
                tone: "danger",
                confirmLabel: "Delete",
              });
              if (result) {
                setError(undefined);
                startTransition(async () => {
                  const deleteResult = await deleteShow(showId, organizationId);
                  if (deleteResult?.error) setError(deleteResult.error);
                });
              }
            }}
          >
            Delete show
          </Button>
        )}
      </div>
    </Card>
  );
}

export function StatusBadge({ status }: { status: ShowStatus }) {
  const styles: Record<ShowStatus, string> = {
    draft:
      "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    published:
      "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
    locked:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    archived:
      "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
