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
import { FormCombobox, type ComboboxOption } from "@/components/combobox";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import type { ShowClass } from "@/lib/types";

export function CreateClassForm({
  showId,
  nextClassNumber,
  classCodeOptions,
}: {
  showId: string;
  nextClassNumber: number;
  classCodeOptions: ComboboxOption[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateClassFormValues, unknown, CreateClassInput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: {
      showId,
      name: "",
      classNumber: nextClassNumber,
      discipline: "Reining",
      division: "",
      avgRunMinutes: "3",
      isYouth: false,
      entryFee: "",
      addedMoney: "",
      scheduledDate: "",
      nrhaClassCode: "",
      classCodeId: "",
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
        <ClassFields register={register} errors={errors} control={control} classCodeOptions={classCodeOptions} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add class"}
        </Button>
      </form>
    </Card>
  );
}

export function EditClassForm({
  showClass,
  classCodeOptions,
}: {
  showClass: ShowClass;
  classCodeOptions: ComboboxOption[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
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
      avgRunMinutes: String(showClass.avg_run_minutes),
      isYouth: showClass.is_youth,
      entryFee: centsToInput(showClass.entry_fee_cents),
      addedMoney: centsToInput(showClass.added_money_cents),
      status: showClass.status,
      scheduledDate: showClass.scheduled_date ?? "",
      nrhaClassCode: showClass.nrha_class_code ?? "",
      classCodeId: showClass.class_code_id ?? "",
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

  const isEarlyStage = CLASS_STATUS_OPTIONS.some(
    (s) => s.value === showClass.status
  );

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Class updated.</Alert>}
        <input type="hidden" {...register("classId")} />
        <div>
          <Label htmlFor="status">Status</Label>
          {isEarlyStage ? (
            <Select id="status" {...register("status")}>
              {CLASS_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <input type="hidden" {...register("status")} />
              <div>
                <ClassStatusBadge status={showClass.status} />
              </div>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                This status is set automatically by the class&apos;s workflow
                (draw, scoring, results) and can&apos;t be changed here.
              </p>
            </>
          )}
          <FieldError message={errors.status?.message} />
        </div>
        <ClassFields register={register} errors={errors} control={control} classCodeOptions={classCodeOptions} />
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
function ClassFields({ register, errors, control, classCodeOptions }: { register: any; errors: any; control: any; classCodeOptions: ComboboxOption[] }) {
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
        <Label htmlFor="classCodeId">Rule package class code (optional)</Label>
        <FormCombobox
          id="classCodeId"
          control={control}
          name="classCodeId"
          options={classCodeOptions}
          placeholder="— None linked —"
          clearable
        />
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Link this class to a code from a rule package so eligibility rules
          from that package apply automatically. Codes come from
          Organization → Rule Packages.
        </p>
      </div>
      <div>
        <Label htmlFor="nrhaClassCode">Manual NRHA class code (optional)</Label>
        <Input
          id="nrhaClassCode"
          placeholder="e.g. 5300"
          {...register("nrhaClassCode")}
        />
        <FieldError message={errors.nrhaClassCode?.message} />
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Used for the NRHA ReinerSuite CSV export if no rule package code is
          linked above.
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
      <div className="grid gap-4 sm:grid-cols-3">
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
          <Label htmlFor="avgRunMinutes">Avg run time (minutes)</Label>
          <Input
            id="avgRunMinutes"
            inputMode="decimal"
            placeholder="3"
            {...register("avgRunMinutes")}
          />
          <FieldError message={errors.avgRunMinutes?.message} />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Used to estimate start times on the Schedule tab.
          </p>
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-stone-300 accent-brand-700"
          {...register("isYouth")}
        />
        Youth class
      </label>
      <p className="-mt-3 text-xs text-stone-500 dark:text-stone-400">
        Exempts this class from NRHA retainage in payout calculations and
        from the show&apos;s standard per-entry charges for entries that are
        youth-only (Show Rules P(7)).
      </p>
    </>
  );
}
