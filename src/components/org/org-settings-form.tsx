"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateOrganization } from "@/app/(app)/organizations/actions";
import {
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from "@/lib/validation/organization";
import { Alert, Button, Card, FieldError, Input, Label } from "@/components/ui";
import type { Organization } from "@/lib/types";

export function OrgSettingsForm({ organization }: { organization: Organization }) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      organizationId: organization.id,
      name: organization.name,
      contactEmail: organization.contact_email ?? "",
      website: organization.website ?? "",
      city: organization.city ?? "",
      state: organization.state ?? "",
    },
  });

  const onSubmit = (values: UpdateOrganizationInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOrganization(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Organization updated.</Alert>}
        <input type="hidden" {...register("organizationId")} />
        <div>
          <Label htmlFor="name">Organization name</Label>
          <Input id="name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" type="email" {...register("contactEmail")} />
          <FieldError message={errors.contactEmail?.message} />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" placeholder="https://…" {...register("website")} />
          <FieldError message={errors.website?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
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
