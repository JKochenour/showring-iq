"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateShow } from "@/app/(app)/shows/actions";
import {
  updateShowSchema,
  US_TIMEZONES,
  type UpdateShowInput,
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
import type { Show } from "@/lib/types";

export function ShowSettingsForm({ show }: { show: Show }) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateShowInput>({
    resolver: zodResolver(updateShowSchema),
    defaultValues: {
      showId: show.id,
      name: show.name,
      slug: show.slug,
      startDate: show.start_date,
      endDate: show.end_date,
      timezone: show.timezone,
      venueName: show.venue_name ?? "",
      city: show.city ?? "",
      state: show.state ?? "",
      contactName: show.contact_name ?? "",
      contactEmail: show.contact_email ?? "",
      contactPhone: show.contact_phone ?? "",
      description: show.description ?? "",
    },
  });

  const onSubmit = (values: UpdateShowInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateShow(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Show updated.</Alert>}
        <input type="hidden" {...register("showId")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Show name</Label>
            <Input id="name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="slug">URL slug</Label>
            <Input id="slug" {...register("slug")} />
            <FieldError message={errors.slug?.message} />
          </div>
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
          </div>
        </div>
        <div>
          <Label htmlFor="venueName">Venue</Label>
          <Input id="venueName" {...register("venueName")} />
          <FieldError message={errors.venueName?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register("city")} />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register("state")} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="contactName">Contact name</Label>
            <Input id="contactName" {...register("contactName")} />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" type="email" {...register("contactEmail")} />
            <FieldError message={errors.contactEmail?.message} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input id="contactPhone" {...register("contactPhone")} />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description / notes</Label>
          <textarea
            id="description"
            rows={4}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            {...register("description")}
          />
          <FieldError message={errors.description?.message} />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
