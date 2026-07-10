"use client";

import { useState, useTransition } from "react";
import { inviteExhibitor } from "@/app/(app)/organizations/[id]/people/actions";
import { Alert, Button, Input, Label } from "@/components/ui";

export function InviteExhibitorForm({ personId }: { personId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <Alert tone="success">
        Invite sent. They&apos;ll see it to accept next time they sign in with that email —
        accepting links this profile to their login automatically.
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {error && <Alert>{error}</Alert>}
      <Label htmlFor="exhibitor-email">Invite as exhibitor (email)</Label>
      <div className="flex gap-2">
        <Input
          id="exhibitor-email"
          type="email"
          placeholder="rider@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={isPending || !email}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              const result = await inviteExhibitor(personId, email);
              if (result?.error) setError(result.error);
              else setDone(true);
            });
          }}
        >
          {isPending ? "Sending…" : "Send invite"}
        </Button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Lets this person sign in and manage their own entries, horses, and documents for this
        organization, without seeing anyone else&apos;s data.
      </p>
    </div>
  );
}
