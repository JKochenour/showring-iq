"use client";

import { useState, useTransition } from "react";
import { deleteShow, setShowStatus } from "@/app/(app)/shows/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
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
  const [isPending, startTransition] = useTransition();

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
            onClick={() => {
              if (
                window.confirm(
                  "Lock this show? Editing is blocked until it is unlocked."
                )
              )
                transition("locked");
            }}
          >
            Lock show
          </Button>
        )}
        {status === "locked" && canLock && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="unlock-reason">Unlock reason (required)</Label>
              <Input
                id="unlock-reason"
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Why is this show being unlocked?"
                className="w-72"
              />
            </div>
            <Button
              disabled={isPending || unlockReason.trim().length === 0}
              onClick={() => transition("published", unlockReason.trim())}
            >
              Unlock show
            </Button>
          </div>
        )}
        {status !== "archived" && canArchive && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              if (window.confirm("Archive this show?")) transition("archived");
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
            onClick={() => {
              if (
                window.confirm(
                  "Permanently delete this draft show? This cannot be undone."
                )
              ) {
                setError(undefined);
                startTransition(async () => {
                  const result = await deleteShow(showId, organizationId);
                  if (result?.error) setError(result.error);
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
