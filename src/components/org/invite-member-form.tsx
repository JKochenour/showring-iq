"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inviteMember } from "@/app/(app)/organizations/actions";
import {
  inviteMemberSchema,
  type InviteMemberInput,
} from "@/lib/validation/organization";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";

export function InviteMemberForm({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: { id: string; name: string }[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { organizationId, email: "", roleId: "" },
  });

  const onSubmit = (values: InviteMemberInput) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await inviteMember(values);
      if (result?.error) {
        setServerError(result.error);
      } else {
        setSuccess(
          `Invite created for ${values.email}. They'll see it on their dashboard when they sign in with that email.`
        );
        reset({ organizationId, email: "", roleId: "" });
      }
    });
  };

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">Invite a member</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
        <input type="hidden" {...register("organizationId")} />
        <div className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="person@example.com"
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select id="invite-role" defaultValue="" {...register("roleId")}>
              <option value="" disabled>
                Choose a role…
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
            <FieldError message={errors.roleId?.message} />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
