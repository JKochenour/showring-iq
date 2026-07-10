"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createShow } from "@/app/(app)/shows/actions";
import { slugify } from "@/lib/validation/organization";
import {
  createShowSchema,
  US_TIMEZONES,
  type CreateShowInput,
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

export function CreateShowForm({ organizationId }: { organizationId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<CreateShowInput>({
    resolver: zodResolver(createShowSchema),
    defaultValues: {
      organizationId,
      name: "",
      slug: "",
      timezone: "America/New_York",
      venueName: "",
      city: "",
      state: "",
      contactEmail: "",
    },
  });

  const onSubmit = (values: CreateShowInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createShow(values);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("organizationId")} />
        <div>
          <Label htmlFor="name">Show name</Label>
          <Input
            id="name"
            placeholder="e.g. EPRHA Summer Slide 2026"
            {...register("name", {
              onChange: (e) => {
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
          <Input id="slug" placeholder="summer-slide-2026" {...register("slug")} />
          <FieldError message={errors.slug?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            <FieldError message={errors.startDate?.message} />
          </div>
          <div>
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" {...register("endDate")} />
            <FieldError message={errors.endDate?.message} />
          </div>
          <div>
            <Label htmlFor="timezone">Time zone</Label>
            <Select id="timezone" {...register("timezone")}>
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.timezone?.message} />
          </div>
        </div>
        <div>
          <Label htmlFor="venueName">Venue (optional)</Label>
          <Input
            id="venueName"
            placeholder="e.g. Keystone Horse Park"
            {...register("venueName")}
          />
          <FieldError message={errors.venueName?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="city">City (optional)</Label>
            <Input id="city" {...register("city")} />
            <FieldError message={errors.city?.message} />
          </div>
          <div>
            <Label htmlFor="state">State (optional)</Label>
            <Input id="state" placeholder="PA" {...register("state")} />
            <FieldError message={errors.state?.message} />
          </div>
        </div>
        <div>
          <Label htmlFor="contactEmail">Show office email (optional)</Label>
          <Input id="contactEmail" type="email" {...register("contactEmail")} />
          <FieldError message={errors.contactEmail?.message} />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create show"}
        </Button>
      </form>
    </Card>
  );
}
