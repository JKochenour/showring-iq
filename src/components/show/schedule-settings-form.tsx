"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateScheduleSettings } from "@/app/(app)/shows/actions";
import {
  updateScheduleSettingsSchema,
  type UpdateScheduleSettingsFormValues,
  type UpdateScheduleSettingsInput,
} from "@/lib/validation/show";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";

export function ScheduleSettingsForm({
  showId,
  startTime,
  breakMinutes,
  dragMinutes,
  canEdit,
}: {
  showId: string;
  startTime: string;
  breakMinutes: number;
  dragMinutes: number;
  canEdit: boolean;
}) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateScheduleSettingsFormValues, unknown, UpdateScheduleSettingsInput>({
    resolver: zodResolver(updateScheduleSettingsSchema),
    defaultValues: { showId, startTime, breakMinutes, dragMinutes },
  });

  const onSubmit = (values: UpdateScheduleSettingsInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateScheduleSettings(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      {saved && <Alert tone="success">Schedule settings saved.</Alert>}
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Used on the Schedule tab to estimate each class&apos;s start time:
        day start + every earlier class that day&apos;s (entries × avg run
        time + drag pauses) + a break between classes. The same daily start
        time applies to every scheduled day.
      </p>
      <input type="hidden" {...register("showId")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="startTime">Daily start time</Label>
          <Input id="startTime" type="time" disabled={!canEdit} {...register("startTime")} />
          <FieldError message={errors.startTime?.message} />
        </div>
        <div>
          <Label htmlFor="breakMinutes">Break between classes (min)</Label>
          <Input
            id="breakMinutes"
            type="number"
            min={0}
            max={120}
            disabled={!canEdit}
            {...register("breakMinutes")}
          />
          <FieldError message={errors.breakMinutes?.message} />
        </div>
        <div>
          <Label htmlFor="dragMinutes">Minutes per drag</Label>
          <Input
            id="dragMinutes"
            type="number"
            min={0}
            max={120}
            disabled={!canEdit}
            {...register("dragMinutes")}
          />
          <FieldError message={errors.dragMinutes?.message} />
        </div>
      </div>
      {canEdit && (
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Save schedule settings"}
        </Button>
      )}
    </form>
  );
}
