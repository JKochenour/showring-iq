"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addStaff, removeStaff } from "@/app/(app)/shows/actions";
import {
  addStaffSchema,
  STAFF_ROLES,
  type AddStaffInput,
} from "@/lib/validation/show";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";

export function AddStaffForm({
  showId,
  members,
}: {
  showId: string;
  members: { userId: string; label: string }[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddStaffInput>({
    resolver: zodResolver(addStaffSchema),
    defaultValues: {
      showId,
      userId: "",
      displayName: "",
      staffRole: "" as AddStaffInput["staffRole"],
      notes: "",
    },
  });

  const selectedUser = watch("userId");

  const onSubmit = (values: AddStaffInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await addStaff(values);
      if (result?.error) setServerError(result.error);
      else
        reset({
          showId,
          userId: "",
          displayName: "",
          staffRole: "" as AddStaffInput["staffRole"],
          notes: "",
        });
    });
  };

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">Add staff</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("showId")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="staff-user">Organization member</Label>
            <Select id="staff-user" {...register("userId")}>
              <option value="">Not a member — enter a name below</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="staff-role">Staff role</Label>
            <Select id="staff-role" defaultValue="" {...register("staffRole")}>
              <option value="" disabled>
                Choose a role…
              </option>
              {STAFF_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.staffRole?.message} />
          </div>
        </div>
        {!selectedUser && (
          <div>
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              placeholder="e.g. Judge Sandy Smith"
              {...register("displayName")}
            />
            <FieldError message={errors.displayName?.message} />
          </div>
        )}
        <div>
          <Label htmlFor="staff-notes">Notes (optional)</Label>
          <Input
            id="staff-notes"
            placeholder="e.g. NRHA judge card #1234"
            {...register("notes")}
          />
          <FieldError message={errors.notes?.message} />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add staff"}
        </Button>
      </form>
    </Card>
  );
}

export function RemoveStaffButton({
  showId,
  staffId,
  label,
}: {
  showId: string;
  staffId: string;
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
          if (!window.confirm(`Remove ${label} from show staff?`)) return;
          setError(undefined);
          startTransition(async () => {
            const result = await removeStaff(showId, staffId);
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
