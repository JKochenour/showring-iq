"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClass,
  updateClass,
} from "@/app/(app)/shows/[id]/classes/actions";
import { centsToInput } from "@/lib/money";
import {
  CLASS_STATUS_OPTIONS,
  createClassSchema,
  updateClassSchema,
  DISCIPLINES,
  type CreateClassFormValues,
  type CreateClassInput,
  type UpdateClassFormValues,
  type UpdateClassInput,
} from "@/lib/validation/class";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export function CreateClassForm({
  showId,
  nextClassNumber,
}: {
  showId: string;
  nextClassNumber: number;
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateClassFormValues, unknown, CreateClassInput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: {
      showId,
      name: "",
      classNumber: nextClassNumber,
      discipline: "Reining",
      division: "",
      entryFee: "",
      addedMoney: "",
      scheduledDate: "",
      nrhaClassCode: "",
      notes: "",
    },
  });

  const onSubmit = (values: CreateClassInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createClass(values);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("showId")} />
        <ClassFields register={register} errors={errors} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add class"}
        </Button>
      </form>
    </Card>
  );
}

export function EditClassForm({ showClass }: { showClass: ShowClass }) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateClassFormValues, unknown, UpdateClassInput>({
    resolver: zodResolver(updateClassSchema),
    defaultValues: {
      classId: showClass.id,
      name: showClass.name,
      classNumber: showClass.class_number,
      discipline: showClass.discipline ?? "",
      division: showClass.division ?? "",
      patternNumber: showClass.pattern_number ?? undefined,
      dragEveryN: showClass.drag_every_n ?? undefined,
      entryFee: centsToInput(showClass.entry_fee_cents),
      addedMoney: centsToInput(showClass.added_money_cents),
      status: showClass.status,
      scheduledDate: showClass.scheduled_date ?? "",
      nrhaClassCode: showClass.nrha_class_code ?? "",
      notes: showClass.notes ?? "",
    },
  });

  const onSubmit = (values: UpdateClassInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateClass(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Class updated.</Alert>}
        <input type="hidden" {...register("classId")} />
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            {CLASS_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <FieldError message={errors.status?.message} />
        </div>
        <ClassFields register={register} errors={errors} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}

/* Shared fields between create and edit. Typed loosely because the two
   forms have different (overlapping) schemas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClassFields({ register, errors }: { register: any; errors: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
        <div>
          <Label htmlFor="classNumber">Class #</Label>
          <Input
            id="classNumber"
            type="number"
            min={1}
            {...register("classNumber")}
          />
          <FieldError message={errors.classNumber?.message} />
        </div>
        <div>
          <Label htmlFor="name">Class name</Label>
          <Input
            id="name"
            placeholder="e.g. Green Reiner Level 1"
            {...register("name")}
          />
          <FieldError message={errors.name?.message} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="discipline">Discipline</Label>
          <Select id="discipline" {...register("discipline")}>
            <option value="">—</option>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="division">Division (optional)</Label>
          <Input
            id="division"
            placeholder="e.g. Non Pro"
            {...register("division")}
          />
          <FieldError message={errors.division?.message} />
        </div>
        <div>
          <Label htmlFor="patternNumber">Pattern # (optional)</Label>
          <Input
            id="patternNumber"
            type="number"
            min={1}
            {...register("patternNumber")}
          />
          <FieldError message={errors.patternNumber?.message} />
        </div>
      </div>
      <div>
        <Label htmlFor="nrhaClassCode">NRHA class code (optional)</Label>
        <Input
          id="nrhaClassCode"
          placeholder="e.g. 5300"
          {...register("nrhaClassCode")}
        />
        <FieldError message={errors.nrhaClassCode?.message} />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Required for the NRHA ReinerSuite CSV export.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="entryFee">Entry fee ($)</Label>
          <Input
            id="entryFee"
            inputMode="decimal"
            placeholder="0.00"
            {...register("entryFee")}
          />
          <FieldError message={errors.entryFee?.message} />
        </div>
        <div>
          <Label htmlFor="addedMoney">Added money ($)</Label>
          <Input
            id="addedMoney"
            inputMode="decimal"
            placeholder="0.00"
            {...register("addedMoney")}
          />
          <FieldError message={errors.addedMoney?.message} />
        </div>
        <div>
          <Label htmlFor="scheduledDate">Scheduled day (optional)</Label>
          <Input id="scheduledDate" type="date" {...register("scheduledDate")} />
          <FieldError message={errors.scheduledDate?.message} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
        <div>
          <Label htmlFor="dragEveryN">Drag every N runs</Label>
          <Input
            id="dragEveryN"
            type="number"
            min={1}
            max={50}
            placeholder="e.g. 8"
            {...register("dragEveryN")}
          />
          <FieldError message={errors.dragEveryN?.message} />
        </div>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            placeholder="e.g. concurrent with Class 13"
            {...register("notes")}
          />
          <FieldError message={errors.notes?.message} />
        </div>
      </div>
    </>
  );
}
