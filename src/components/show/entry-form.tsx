"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEntry,
  getEntryForCopy,
  listEntriesForCopy,
  listSourceShowsForCopy,
} from "@/app/(app)/shows/[id]/entries/actions";
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
  organizationId,
  riders,
  owners,
  trainers,
  payees,
  horses,
  classes,
  lateEntryFeeCents,
}: {
  showId: string;
  organizationId: string;
  riders: PersonOption[];
  owners: PersonOption[];
  trainers: PersonOption[];
  /** Anyone in the org can receive winning checks (owner/exhibitor/other). */
  payees: PersonOption[];
  horses: { id: string; label: string }[];
  classes: ClassOption[];
  lateEntryFeeCents?: number;
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateEntryFormValues, unknown, CreateEntryInput>({
    resolver: zodResolver(createEntrySchema),
    defaultValues: {
      showId,
      riderPersonId: "",
      horseId: "",
      ownerPersonId: "",
      trainerPersonId: "",
      payeePersonId: "",
      classIds: [],
      backNumberMode: "auto",
      backNumber: "",
      lateEntry: false,
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

  const [copySourceShows, setCopySourceShows] = useState<
    { id: string; label: string }[] | null
  >(null);
  const [copyShowId, setCopyShowId] = useState("");
  const [copyEntries, setCopyEntries] = useState<{ id: string; label: string }[]>([]);
  const [copyEntryId, setCopyEntryId] = useState("");
  const [copyNote, setCopyNote] = useState<string>();
  const [isCopying, startCopyTransition] = useTransition();

  const openCopyPicker = () => {
    startCopyTransition(async () => {
      const shows = await listSourceShowsForCopy(showId, organizationId);
      setCopySourceShows(shows.map((s) => ({ id: s.id, label: s.name })));
    });
  };

  const pickCopySourceShow = (sourceShowId: string) => {
    setCopyShowId(sourceShowId);
    setCopyEntryId("");
    setCopyEntries([]);
    if (!sourceShowId) return;
    startCopyTransition(async () => {
      setCopyEntries(await listEntriesForCopy(sourceShowId));
    });
  };

  const loadCopy = () => {
    if (!copyEntryId) return;
    startCopyTransition(async () => {
      const result = await getEntryForCopy(copyEntryId, showId);
      if ("error" in result) {
        setCopyNote(result.error);
        return;
      }
      setValue("riderPersonId", result.riderPersonId);
      setValue("ownerPersonId", result.ownerPersonId);
      setValue("trainerPersonId", result.trainerPersonId);
      setValue("payeePersonId", result.payeePersonId);
      setValue("horseId", result.horseId);
      setValue("notes", result.notes);
      setValue("classIds", result.matchedClassIds);
      setCopyNote(
        result.matchedClassIds.length > 0
          ? `Loaded. ${result.matchedClassIds.length} class${result.matchedClassIds.length === 1 ? "" : "es"} matched by name in this show — review before submitting.`
          : "Loaded rider/horse/owner/trainer. No classes matched by name in this show — pick classes below."
      );
    });
  };

  return (
    <Card className="max-w-2xl">
      <div className="mb-5 rounded-md border border-stone-200 p-3 dark:border-stone-800">
        {!copySourceShows ? (
          <Button type="button" variant="secondary" disabled={isCopying} onClick={openCopyPicker}>
            {isCopying ? "Loading…" : "Copy from another show"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Copy rider/horse/owner/trainer from an entry in another show
            </p>
            {copyNote && (
              <p className="text-xs text-brand-700 dark:text-brand-400">{copyNote}</p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <select
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
                value={copyShowId}
                onChange={(e) => pickCopySourceShow(e.target.value)}
              >
                <option value="">Choose a show…</option>
                {copySourceShows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
                value={copyEntryId}
                disabled={copyEntries.length === 0}
                onChange={(e) => setCopyEntryId(e.target.value)}
              >
                <option value="">Choose an entry…</option>
                {copyEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                disabled={!copyEntryId || isCopying}
                onClick={loadCopy}
              >
                {isCopying ? "Loading…" : "Load"}
              </Button>
            </div>
          </div>
        )}
      </div>
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
          <div className="sm:col-span-2">
            <Label htmlFor="payee">Winning checks to (optional)</Label>
            <FormCombobox
              id="payee"
              control={control}
              name="payeePersonId"
              options={payees}
              placeholder="Default — owner, then rider"
              clearable
            />
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Who receives winning checks — separate from who pays the bill.
              The payee needs a verified W-9 on file.
            </p>
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

        {!!lateEntryFeeCents && lateEntryFeeCents > 0 && (
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                {...register("lateEntry")}
              />
              Late entry (adds a {formatCents(lateEntryFeeCents)} fee to the bill)
            </label>
          </div>
        )}

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
