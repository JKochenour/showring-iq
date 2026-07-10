"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPerson,
  updatePerson,
} from "@/app/(app)/organizations/[id]/people/actions";
import {
  createPersonSchema,
  updatePersonSchema,
  PERSON_ROLES,
  type CreatePersonFormValues,
  type CreatePersonInput,
  type UpdatePersonFormValues,
  type UpdatePersonInput,
} from "@/lib/validation/person";
import { Alert, Button, Card, FieldError, Input, Label } from "@/components/ui";
import type { Person } from "@/lib/types";

export function CreatePersonForm({ organizationId }: { organizationId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePersonFormValues, unknown, CreatePersonInput>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: {
      organizationId,
      firstName: "",
      lastName: "",
      preferredName: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      birthdate: "",
      roles: ["rider"],
      notes: "",
    },
  });

  const onSubmit = (values: CreatePersonInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createPerson(values);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("organizationId")} />
        <PersonFields register={register} errors={errors} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add person"}
        </Button>
      </form>
    </Card>
  );
}

export function EditPersonForm({ person }: { person: Person }) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePersonFormValues, unknown, UpdatePersonInput>({
    resolver: zodResolver(updatePersonSchema),
    defaultValues: {
      personId: person.id,
      firstName: person.first_name,
      lastName: person.last_name,
      preferredName: person.preferred_name ?? "",
      email: person.email ?? "",
      phone: person.phone ?? "",
      city: person.city ?? "",
      state: person.state ?? "",
      birthdate: person.birthdate ?? "",
      roles: person.roles,
      notes: person.notes ?? "",
    },
  });

  const onSubmit = (values: UpdatePersonInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePerson(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Person updated.</Alert>}
        <input type="hidden" {...register("personId")} />
        <PersonFields register={register} errors={errors} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PersonFields({ register, errors }: { register: any; errors: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register("firstName")} />
          <FieldError message={errors.firstName?.message} />
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register("lastName")} />
          <FieldError message={errors.lastName?.message} />
        </div>
        <div>
          <Label htmlFor="preferredName">Preferred name</Label>
          <Input id="preferredName" {...register("preferredName")} />
        </div>
      </div>
      <div>
        <Label>Roles</Label>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PERSON_ROLES.map((role) => (
            <label
              key={role.value}
              className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="checkbox"
                value={role.value}
                className="h-4 w-4 rounded border-zinc-300 accent-emerald-700"
                {...register("roles")}
              />
              {role.label}
            </label>
          ))}
        </div>
        <FieldError message={errors.roles?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register("city")} />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input id="state" {...register("state")} />
        </div>
        <div>
          <Label htmlFor="birthdate">Birthdate</Label>
          <Input id="birthdate" type="date" {...register("birthdate")} />
          <FieldError message={errors.birthdate?.message} />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Used for youth/age eligibility checks
          </p>
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" {...register("notes")} />
      </div>
    </>
  );
}
