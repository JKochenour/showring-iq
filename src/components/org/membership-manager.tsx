"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMembership } from "@/app/(app)/organizations/[id]/people/actions";
import {
  addMembershipSchema,
  ASSOCIATIONS,
  MEMBERSHIP_STATUS_OPTIONS,
  type AddMembershipInput,
} from "@/lib/validation/person";
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";

export function AddMembershipForm({ personId }: { personId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddMembershipInput>({
    resolver: zodResolver(addMembershipSchema),
    defaultValues: {
      personId,
      association: "NRHA",
      membershipNumber: "",
      membershipType: "",
      status: "active",
      expirationDate: "",
      notes: "",
    },
  });

  const onSubmit = (values: AddMembershipInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await addMembership(values);
      if (result?.error) setServerError(result.error);
      else
        reset({
          personId,
          association: "NRHA",
          membershipNumber: "",
          membershipType: "",
          status: "active",
          expirationDate: "",
          notes: "",
        });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      <input type="hidden" {...register("personId")} />
      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <Label htmlFor="m-association">Association</Label>
          <Select id="m-association" {...register("association")}>
            {ASSOCIATIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <FieldError message={errors.association?.message} />
        </div>
        <div>
          <Label htmlFor="m-number">Member #</Label>
          <Input id="m-number" {...register("membershipNumber")} />
          <FieldError message={errors.membershipNumber?.message} />
        </div>
        <div>
          <Label htmlFor="m-type">Type</Label>
          <Input
            id="m-type"
            placeholder="e.g. Non Pro"
            {...register("membershipType")}
          />
        </div>
        <div>
          <Label htmlFor="m-status">Status</Label>
          <Select id="m-status" {...register("status")}>
            {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="m-expires">Expires</Label>
          <Input id="m-expires" type="date" {...register("expirationDate")} />
          <FieldError message={errors.expirationDate?.message} />
        </div>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : "Add membership"}
      </Button>
    </form>
  );
}
