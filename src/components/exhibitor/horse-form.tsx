"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOwnHorse, updateOwnHorse } from "@/app/(exhibitor)/exhibitor/[orgId]/horses/actions";
import {
  createOwnHorseSchema,
  updateOwnHorseSchema,
  HORSE_SEXES,
  type CreateOwnHorseFormValues,
  type CreateOwnHorseInput,
  type UpdateOwnHorseFormValues,
  type UpdateOwnHorseInput,
} from "@/lib/validation/horse";
import { Alert, Button, Card, FieldError, Input, Label, Select } from "@/components/ui";
import type { Horse } from "@/lib/types";

export function CreateOwnHorseForm({ organizationId }: { organizationId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOwnHorseFormValues, unknown, CreateOwnHorseInput>({
    resolver: zodResolver(createOwnHorseSchema),
    defaultValues: {
      organizationId,
      registeredName: "",
      barnName: "",
      breed: "",
      sex: "",
      color: "",
      sire: "",
      dam: "",
    },
  });

  const onSubmit = (values: CreateOwnHorseInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createOwnHorse(values);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("organizationId")} />
        <div>
          <Label htmlFor="registeredName">Registered name</Label>
          <Input
            id="registeredName"
            placeholder="e.g. Smart Spook Whiz"
            {...register("registeredName")}
          />
          <FieldError message={errors.registeredName?.message} />
        </div>
        <HorseFields register={register} errors={errors} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add horse"}
        </Button>
      </form>
    </Card>
  );
}

export function EditOwnHorseForm({
  horse,
  organizationId,
}: {
  horse: Horse;
  organizationId: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateOwnHorseFormValues, unknown, UpdateOwnHorseInput>({
    resolver: zodResolver(updateOwnHorseSchema),
    defaultValues: {
      horseId: horse.id,
      organizationId,
      barnName: horse.barn_name ?? "",
      breed: horse.breed ?? "",
      sex: (horse.sex as UpdateOwnHorseFormValues["sex"]) ?? "",
      color: horse.color ?? "",
      foalYear: horse.foal_year ?? undefined,
      sire: horse.sire ?? "",
      dam: horse.dam ?? "",
    },
  });

  const onSubmit = (values: UpdateOwnHorseInput) => {
    setServerError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOwnHorse(values);
      if (result?.error) setServerError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {saved && <Alert tone="success">Horse updated.</Alert>}
        <input type="hidden" {...register("horseId")} />
        <input type="hidden" {...register("organizationId")} />
        <div>
          <Label htmlFor="registeredName">Registered name</Label>
          <Input id="registeredName" value={horse.registered_name} disabled />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Contact the show office to correct the registered name.
          </p>
        </div>
        <HorseFields register={register} errors={errors} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HorseFields({ register, errors }: { register: any; errors: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="barnName">Barn name</Label>
          <Input id="barnName" placeholder="e.g. Smarty" {...register("barnName")} />
        </div>
        <div>
          <Label htmlFor="breed">Breed</Label>
          <Input id="breed" placeholder="e.g. AQHA" {...register("breed")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="sex">Sex</Label>
          <Select id="sex" {...register("sex")}>
            <option value="">—</option>
            {HORSE_SEXES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="color">Color</Label>
          <Input id="color" placeholder="e.g. Sorrel" {...register("color")} />
        </div>
        <div>
          <Label htmlFor="foalYear">Foal year</Label>
          <Input id="foalYear" type="number" placeholder="2019" {...register("foalYear")} />
          <FieldError message={errors.foalYear?.message} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sire">Sire</Label>
          <Input id="sire" {...register("sire")} />
        </div>
        <div>
          <Label htmlFor="dam">Dam</Label>
          <Input id="dam" {...register("dam")} />
        </div>
      </div>
    </>
  );
}
