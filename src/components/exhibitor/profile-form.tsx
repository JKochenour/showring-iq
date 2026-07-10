"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateOwnProfile } from "@/app/(exhibitor)/exhibitor/[orgId]/profile/actions";
import {
  exhibitorUpdateProfileSchema,
  type ExhibitorUpdateProfileFormValues,
  type ExhibitorUpdateProfileInput,
} from "@/lib/validation/person";
import { Alert, Button, Card, FieldError, Input, Label } from "@/components/ui";
import type { Person } from "@/lib/types";

export function ProfileForm({ person }: { person: Person }) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExhibitorUpdateProfileFormValues, unknown, ExhibitorUpdateProfileInput>({
    resolver: zodResolver(exhibitorUpdateProfileSchema),
    defaultValues: {
      personId: person.id,
      preferredName: person.preferred_name ?? "",
      email: person.email ?? "",
      phone: person.phone ?? "",
      city: person.city ?? "",
      state: person.state ?? "",
      birthdate: person.birthdate ?? "",
    },
  });

  const onSubmit = (values: ExhibitorUpdateProfileInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOwnProfile(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Profile updated.</Alert>}
        <input type="hidden" {...register("personId")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="preferredName">Preferred name</Label>
            <Input id="preferredName" {...register("preferredName")} />
            <FieldError message={errors.preferredName?.message} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
            <FieldError message={errors.phone?.message} />
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register("city")} />
            <FieldError message={errors.city?.message} />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register("state")} />
            <FieldError message={errors.state?.message} />
          </div>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
