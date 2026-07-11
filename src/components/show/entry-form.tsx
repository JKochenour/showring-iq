"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createEntry } from "@/app/(app)/shows/[id]/entries/actions";
import { formatCents } from "@/lib/money";
import {
  createEntrySchema,
  type CreateEntryFormValues,
  type CreateEntryInput,
} from "@/lib/validation/entry";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Input,
  Label,
} from "@/components/ui";
import { FormCombobox } from "@/components/combobox";

export interface PersonOption {
  id: string;
  label: string;
}

export interface ClassOption {
  id: string;
  classNumber: number;
  name: string;
  feeCents: number;
  status: string;
}

export function CreateEntryForm({
  showId,
  riders,
  owners,
  trainers,
  horses,
  classes,
}: {
  showId: string;
  riders: PersonOption[];
  owners: PersonOption[];
  trainers: PersonOption[];
  horses: { id: string; label: string }[];
  classes: ClassOption[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateEntryFormValues, unknown, CreateEntryInput>({
    resolver: zodResolver(createEntrySchema),
    defaultValues: {
      showId,
      riderPersonId: "",
      horseId: "",
      ownerPersonId: "",
      trainerPersonId: "",
      classIds: [],
      backNumberMode: "auto",
      backNumber: "",
      notes: "",
    },
  });

  const backNumberMode = watch("backNumberMode");
  const selectedClassIds = watch("classIds");
  const selectedTotal = classes
    .filter(
      (c) =>
        Array.isArray(selectedClassIds) && selectedClassIds.includes(c.id)
    )
    .reduce((sum, c) => sum + c.feeCents, 0);

  const onSubmit = (values: CreateEntryInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createEntry(values);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("showId")} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rider">Rider</Label>
            <FormCombobox
              id="rider"
              control={control}
              name="riderPersonId"
              options={riders}
              placeholder="Choose a rider…"
              invalid={!!errors.riderPersonId}
            />
            <FieldError message={errors.riderPersonId?.message} />
          </div>
          <div>
            <Label htmlFor="horse">Horse</Label>
            <FormCombobox
              id="horse"
              control={control}
              name="horseId"
              options={horses}
              placeholder="Choose a horse…"
              invalid={!!errors.horseId}
            />
            <FieldError message={errors.horseId?.message} />
          </div>
          <div>
            <Label htmlFor="owner">Owner (optional)</Label>
            <FormCombobox
              id="owner"
              control={control}
              name="ownerPersonId"
              options={owners}
              placeholder="—"
              clearable
            />
          </div>
          <div>
            <Label htmlFor="trainer">Trainer (optional)</Label>
            <FormCombobox
              id="trainer"
              control={control}
              name="trainerPersonId"
              options={trainers}
              placeholder="—"
              clearable
            />
          </div>
        </div>

        <div>
          <Label>Classes</Label>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-3 dark:border-stone-800">
            {classes.length === 0 && (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No classes available — add classes to the show first.
              </p>
            )}
            {classes.map((cls) => (
              <label
                key={cls.id}
                className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={cls.id}
                    className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                    {...register("classIds")}
                  />
                  <span className="font-mono text-xs text-stone-500">
                    {cls.classNumber}
                  </span>
                  {cls.name}
                </span>
                <span className="text-stone-500 dark:text-stone-400">
                  {formatCents(cls.feeCents)}
                </span>
              </label>
            ))}
          </div>
          <FieldError message={errors.classIds?.message as string | undefined} />
          {selectedTotal > 0 && (
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              Class fees: <b>{formatCents(selectedTotal)}</b>
            </p>
          )}
        </div>

        <div>
          <Label>Back number</Label>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="auto"
                className="accent-brand-700"
                {...register("backNumberMode")}
              />
              Auto-assign next
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="manual"
                className="accent-brand-700"
                {...register("backNumberMode")}
              />
              Specific number
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="none"
                className="accent-brand-700"
                {...register("backNumberMode")}
              />
              Assign later
            </label>
            {backNumberMode === "manual" && (
              <Input
                type="number"
                min={1}
                max={9999}
                placeholder="e.g. 214"
                className="w-28"
                {...register("backNumber")}
              />
            )}
          </div>
          <FieldError message={errors.backNumber?.message} />
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" {...register("notes")} />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create entry"}
        </Button>
      </form>
    </Card>
  );
}
