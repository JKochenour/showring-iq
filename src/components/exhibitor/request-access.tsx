"use client";

import { useState, useTransition } from "react";
import { requestExhibitorAccess } from "@/app/(exhibitor)/exhibitor/actions";
import { Alert, Button, Card, Label } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import type { ExhibitorJoinRequest } from "@/lib/types";

/** Self-serve side of exhibitor access (00049): pick an organization,
 * say who you are, and the show office approves from their People
 * page. Shown on the exhibitor org picker for orgs the user isn't
 * linked to yet. */
export function RequestAccess({
  orgs,
  orgNames,
  myRequests,
}: {
  /** Orgs the user can still request (not yet linked). */
  orgs: { id: string; label: string }[];
  /** id -> name for EVERY directory org, so resolved requests still name theirs. */
  orgNames: Record<string, string>;
  myRequests: ExhibitorJoinRequest[];
}) {
  const [orgId, setOrgId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    setSent(false);
    if (!orgId) return setError("Choose an organization.");
    startTransition(async () => {
      const result = await requestExhibitorAccess({
        organizationId: orgId,
        message,
      });
      if (result?.error) setError(result.error);
      else {
        setSent(true);
        setOrgId("");
        setMessage("");
      }
    });
  };

  const orgName = (id: string) => orgNames[id] ?? "that organization";

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <h2 className="mb-1 text-base font-semibold">
          Request exhibitor access
        </h2>
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          Ask a show organization to connect your login so you can enter
          their shows online. The show office reviews every request — if
          you&apos;ve shown with them before, mention it so they can link
          your existing record.
        </p>
        {error && (
          <div className="mb-3">
            <Alert>{error}</Alert>
          </div>
        )}
        {sent && (
          <div className="mb-3">
            <Alert tone="success">
              Request sent — the show office will review it. Check back
              here for the result.
            </Alert>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="req-org">Organization</Label>
            <div className="max-w-sm">
              <Combobox
                id="req-org"
                options={orgs}
                value={orgId}
                onChange={setOrgId}
                placeholder="Choose an organization…"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="req-message">Message (optional)</Label>
            <textarea
              id="req-message"
              rows={2}
              maxLength={1000}
              className="mt-1 w-full max-w-lg rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              placeholder="e.g. I showed with you last season under Jamie Tester."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button disabled={isPending} onClick={submit}>
            {isPending ? "Sending…" : "Request access"}
          </Button>
        </div>
      </Card>

      {myRequests.length > 0 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">Your requests</h2>
          <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
            {myRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span className="font-medium">{orgName(r.organization_id)}</span>
                {r.status === "pending" && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Pending review
                  </span>
                )}
                {r.status === "approved" && (
                  <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                    Approved
                  </span>
                )}
                {r.status === "declined" && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    Declined
                  </span>
                )}
                {r.status === "declined" && r.decline_reason && (
                  <span className="text-stone-500 dark:text-stone-400">
                    {r.decline_reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
