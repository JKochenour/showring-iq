"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/app/(app)/organizations/actions";
import { Alert, Button, Card } from "@/components/ui";
import type { PendingInvite } from "@/lib/types";

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  if (invites.length === 0) return null;

  return (
    <Card className="border-brand-200 dark:border-brand-900">
      <h2 className="mb-1 text-base font-semibold">You&apos;ve been invited</h2>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        Accept an invite to join the organization with the assigned role.
      </p>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <ul className="space-y-3">
        {invites.map((invite) => (
          <li
            key={invite.invite_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 px-4 py-3 dark:border-stone-800"
          >
            <div>
              <p className="text-sm font-medium">{invite.organization_name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Role: {invite.role_name}
                {invite.invited_by_email && ` · invited by ${invite.invited_by_email}`}
              </p>
            </div>
            <Button
              disabled={isPending}
              onClick={() => {
                setError(undefined);
                startTransition(async () => {
                  const result = await acceptInvite(invite.invite_id);
                  if (result?.error) setError(result.error);
                });
              }}
            >
              {isPending ? "Joining…" : "Accept"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
