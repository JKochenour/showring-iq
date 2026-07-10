"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addOwnership,
  addRegistration,
} from "@/app/(app)/organizations/[id]/horses/actions";
import {
  addOwnershipSchema,
  addRegistrationSchema,
  type AddOwnershipFormValues,
  type AddOwnershipInput,
  type AddRegistrationInput,
} from "@/lib/validation/horse";
import {
  ASSOCIATIONS,
  MEMBERSHIP_STATUS_OPTIONS,
} from "@/lib/validation/person";
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { FormCombobox } from "@/components/combobox";

export function AddRegistrationForm({ horseId }: { horseId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddRegistrationInput>({
    resolver: zodResolver(addRegistrationSchema),
    defaultValues: {
      horseId,
      association: "NRHA",
      registrationNumber: "",
      competitionLicenseNumber: "",
      status: "active",
      expirationDate: "",
      notes: "",
    },
  });

  const onSubmit = (values: AddRegistrationInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await addRegistration(values);
      if (result?.error) setServerError(result.error);
      else
        reset({
          horseId,
          association: "NRHA",
          registrationNumber: "",
          competitionLicenseNumber: "",
          status: "active",
          expirationDate: "",
          notes: "",
        });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      <input type="hidden" {...register("horseId")} />
      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <Label htmlFor="r-association">Association</Label>
          <Select id="r-association" {...register("association")}>
            {ASSOCIATIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="r-reg">Registration #</Label>
          <Input id="r-reg" {...register("registrationNumber")} />
          <FieldError message={errors.registrationNumber?.message} />
        </div>
        <div>
          <Label htmlFor="r-license">Competition license #</Label>
          <Input id="r-license" {...register("competitionLicenseNumber")} />
        </div>
        <div>
          <Label htmlFor="r-status">Status</Label>
          <Select id="r-status" {...register("status")}>
            {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="r-expires">Expires</Label>
          <Input id="r-expires" type="date" {...register("expirationDate")} />
          <FieldError message={errors.expirationDate?.message} />
        </div>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : "Add registration"}
      </Button>
    </form>
  );
}

export function AddOwnershipForm({
  horseId,
  people,
}: {
  horseId: string;
  people: { id: string; label: string }[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AddOwnershipFormValues, unknown, AddOwnershipInput>({
    resolver: zodResolver(addOwnershipSchema),
    defaultValues: {
      horseId,
      ownerPersonId: "",
      percentage: 100,
      startDate: "",
      notes: "",
    },
  });

  const onSubmit = (values: AddOwnershipInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await addOwnership(values);
      if (result?.error) setServerError(result.error);
      else
        reset({
          horseId,
          ownerPersonId: "",
          percentage: 100,
          startDate: "",
          notes: "",
        });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      <input type="hidden" {...register("horseId")} />
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_170px_auto] sm:items-end">
        <div>
          <Label htmlFor="o-person">Owner</Label>
          <FormCombobox
            id="o-person"
            control={control}
            name="ownerPersonId"
            options={people}
            placeholder="Choose a person…"
            invalid={!!errors.ownerPersonId}
          />
          <FieldError message={errors.ownerPersonId?.message} />
        </div>
        <div>
          <Label htmlFor="o-pct">Ownership %</Label>
          <Input
            id="o-pct"
            type="number"
            min={1}
            max={100}
            {...register("percentage")}
          />
          <FieldError message={errors.percentage?.message} />
        </div>
        <div>
          <Label htmlFor="o-start">Since (optional)</Label>
          <Input id="o-start" type="date" {...register("startDate")} />
          <FieldError message={errors.startDate?.message} />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Adding…" : "Add owner"}
        </Button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        People must have the Owner role to appear here. Ownership relationships
        feed Non Pro / amateur eligibility checks in later sprints.
      </p>
    </form>
  );
}
