"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrganization } from "@/app/(app)/organizations/actions";
import {
  createOrganizationSchema,
  slugify,
  type CreateOrganizationInput,
} from "@/lib/validation/organization";
import { Alert, Button, Card, FieldError, Input, Label } from "@/components/ui";

export function CreateOrgForm() {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", slug: "", contactEmail: "" },
  });

  const onSubmit = (values: CreateOrganizationInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createOrganization(values);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <div>
          <Label htmlFor="name">Organization name</Label>
          <Input
            id="name"
            placeholder="e.g. EPRHA"
            {...register("name", {
              onChange: (e) => {
                // Keep slug in sync until the user edits it by hand
                if (!getFieldState("slug").isDirty) {
                  setValue("slug", slugify(e.target.value));
                }
              },
            })}
          />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" placeholder="e.g. eprha" {...register("slug")} />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Public pages will live at showringiq.com/<b>slug</b>/…
          </p>
          <FieldError message={errors.slug?.message} />
        </div>
        <div>
          <Label htmlFor="contactEmail">Contact email (optional)</Label>
          <Input
            id="contactEmail"
            type="email"
            placeholder="office@eprha.org"
            {...register("contactEmail")}
          />
          <FieldError message={errors.contactEmail?.message} />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </Card>
  );
}
