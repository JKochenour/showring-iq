"use client";

import { useState, useTransition } from "react";
import {
  approveJoinRequest,
  declineJoinRequest,
} from "@/app/(app)/organizations/[id]/people/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { ExhibitorJoinRequest } from "@/lib/types";

/** The office's queue of self-serve exhibitor access requests (00049).
 * Approving links the requester's login to a person record — an
 * existing unclaimed one (typo-proof: reuses their show history) or a
 * brand-new record when they're genuinely new. */
export function JoinRequestsCard({
  organizationId,
  requests,
  unlinkedPeople,
}: {
  organizationId: string;
  requests: ExhibitorJoinRequest[];
  /** Org people with no login linked yet — approve-by-linking options. */
  unlinkedPeople: { id: string; label: string }[];
}) {
  if (requests.length === 0) return null;
  return (
    <Card className="mb-6 border-brand-300 dark:border-brand-800">
      <h3 className="mb-1 text-base font-semibold">
        Exhibitor access requests ({requests.length})
      </h3>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        People who signed up and asked to enter your shows online. Link
        each to their existing person record if they already show with
        you — or create a new record if they&apos;re new.
      </p>
      <div className="divide-y divide-stone-200 dark:divide-stone-800">
        {requests.map((r) => (
          <JoinRequestRow
            key={r.id}
            organizationId={organizationId}
            request={r}
            unlinkedPeople={unlinkedPeople}
          />
        ))}
      </div>
    </Card>
  );
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { first: full.trim(), last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function JoinRequestRow({
  organizationId,
  request,
  unlinkedPeople,
}: {
  organizationId: string;
  request: ExhibitorJoinRequest;
  unlinkedPeople: { id: string; label: string }[];
}) {
  const guess = splitName(request.requester_name);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<"link" | "create">(
    unlinkedPeople.length > 0 ? "link" : "create"
  );
  const [personId, setPersonId] = useState("");
  const [firstName, setFirstName] = useState(guess.first);
  const [lastName, setLastName] = useState(guess.last);
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const approve = () => {
    setError(undefined);
    if (mode === "link" && !personId) {
      setError("Choose the person record to link.");
      return;
    }
    startTransition(async () => {
      const result = await approveJoinRequest({
        requestId: request.id,
        organizationId,
        personId: mode === "link" ? personId : undefined,
        firstName: mode === "create" ? firstName : undefined,
        lastName: mode === "create" ? lastName : undefined,
      });
      if (result?.error) setError(result.error);
    });
  };

  const decline = async () => {
    const result = await confirm({
      title: "Decline request",
      message: `Decline ${request.requester_name}'s exhibitor access request? They'll see the reason you give.`,
      tone: "danger",
      confirmLabel: "Decline",
      fields: [{ name: "reason", label: "Reason" }],
    });
    if (!result) return;
    setError(undefined);
    startTransition(async () => {
      const declineResult = await declineJoinRequest({
        requestId: request.id,
        organizationId,
        reason: result.reason,
      });
      if (declineResult?.error) setError(declineResult.error);
    });
  };

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-medium">{request.requester_name}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {request.requester_email} ·{" "}
          {new Date(request.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      {request.message && (
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          “{request.message}”
        </p>
      )}
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {unlinkedPeople.length > 0 && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-brand-700"
              checked={mode === "link"}
              onChange={() => setMode("link")}
            />
            Link existing person
          </label>
        )}
        <label className="flex items-center gap-2">
          <input
            type="radio"
            className="accent-brand-700"
            checked={mode === "create"}
            onChange={() => setMode("create")}
          />
          Create new person
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        {mode === "link" ? (
          <div className="min-w-64">
            <Combobox
              options={unlinkedPeople}
              value={personId}
              onChange={setPersonId}
              placeholder="Choose their person record…"
            />
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor={`jr-first-${request.id}`}>First name</Label>
              <Input
                id={`jr-first-${request.id}`}
                className="w-40"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`jr-last-${request.id}`}>Last name</Label>
              <Input
                id={`jr-last-${request.id}`}
                className="w-40"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </>
        )}
        <Button disabled={isPending} onClick={approve}>
          {isPending ? "Working…" : "Approve"}
        </Button>
        <Button variant="danger" disabled={isPending} onClick={decline}>
          Decline
        </Button>
      </div>
    </div>
  );
}
