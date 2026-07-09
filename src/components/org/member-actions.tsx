"use client";

import { useState, useTransition } from "react";
import {
  removeMember,
  revokeInvite,
  setMemberRole,
} from "@/app/(app)/organizations/actions";
import { Button, Select } from "@/components/ui";

export function MemberRoleSelect({
  organizationId,
  memberId,
  currentRoleId,
  roles,
  disabled,
}: {
  organizationId: string;
  memberId: string;
  currentRoleId: string;
  roles: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Select
        value={currentRoleId}
        disabled={disabled || isPending}
        onChange={(e) => {
          setError(undefined);
          const roleId = e.target.value;
          startTransition(async () => {
            const result = await setMemberRole(organizationId, memberId, roleId);
            if (result?.error) setError(result.error);
          });
        }}
        className="w-52"
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </Select>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function RemoveMemberButton({
  organizationId,
  memberId,
  memberLabel,
  isSelf,
}: {
  organizationId: string;
  memberId: string;
  memberLabel: string;
  isSelf: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        variant="danger"
        disabled={isPending}
        onClick={() => {
          const verb = isSelf ? "Leave this organization" : `Remove ${memberLabel}`;
          if (!window.confirm(`${verb}? This can be undone by re-inviting.`)) return;
          setError(undefined);
          startTransition(async () => {
            const result = await removeMember(organizationId, memberId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Working…" : isSelf ? "Leave" : "Remove"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function RevokeInviteButton({
  organizationId,
  inviteId,
}: {
  organizationId: string;
  inviteId: string;
}) {
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
            const result = await revokeInvite(organizationId, inviteId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Revoking…" : "Revoke"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
