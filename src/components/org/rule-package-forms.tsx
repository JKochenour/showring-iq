"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAssociation,
  createClassCode,
  createEligibilityRule,
  createRulePackage,
} from "@/app/(app)/organizations/[id]/rule-packages/actions";
import {
  CONDITION_OPERATORS,
  createAssociationSchema,
  createClassCodeSchema,
  createEligibilityRuleSchema,
  createRulePackageSchema,
  type CreateAssociationInput,
  type CreateClassCodeFormValues,
  type CreateClassCodeInput,
  type CreateEligibilityRuleInput,
  type CreateRulePackageFormValues,
  type CreateRulePackageInput,
} from "@/lib/validation/rule-package";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";

export function CreateAssociationForm({ organizationId }: { organizationId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAssociationInput>({
    resolver: zodResolver(createAssociationSchema),
    defaultValues: { organizationId, name: "" },
  });

  const onSubmit = (values: CreateAssociationInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createAssociation(values);
      if (result?.error) setServerError(result.error);
      else reset({ organizationId, name: "" });
    });
  };

  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">Add association</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <input type="hidden" {...register("organizationId")} />
        <div>
          <Label htmlFor="assoc-name">Name</Label>
          <Input id="assoc-name" placeholder="e.g. NRHA" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </form>
    </Card>
  );
}

export function CreateRulePackageForm({
  organizationId,
  associations,
}: {
  organizationId: string;
  associations: { id: string; name: string }[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRulePackageFormValues, unknown, CreateRulePackageInput>({
    resolver: zodResolver(createRulePackageSchema),
    defaultValues: {
      associationId: associations[0]?.id ?? "",
      year: new Date().getUTCFullYear(),
      version: "1",
      sourceNotes: "",
    },
  });

  const onSubmit = (values: CreateRulePackageInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createRulePackage(values, organizationId);
      if (result?.error) setServerError(result.error);
      else reset();
    });
  };

  if (associations.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">Create rule package</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="rp-assoc">Association</Label>
            <Select id="rp-assoc" {...register("associationId")}>
              {associations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rp-year">Year</Label>
            <Input id="rp-year" type="number" {...register("year")} />
            <FieldError message={errors.year?.message} />
          </div>
          <div>
            <Label htmlFor="rp-version">Version</Label>
            <Input id="rp-version" {...register("version")} />
            <FieldError message={errors.version?.message} />
          </div>
          <div>
            <Label htmlFor="rp-notes">Source notes</Label>
            <Input id="rp-notes" placeholder="optional" {...register("sourceNotes")} />
          </div>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create rule package (draft)"}
        </Button>
      </form>
    </Card>
  );
}

export function AddClassCodeForm({ rulePackageId }: { rulePackageId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClassCodeFormValues, unknown, CreateClassCodeInput>({
    resolver: zodResolver(createClassCodeSchema),
    defaultValues: {
      rulePackageId,
      code: "",
      name: "",
      discipline: "",
      division: "",
      isYouth: false,
      isAmateur: false,
      isOpen: false,
      isNonPro: false,
      countsForPoints: true,
      countsForMoney: true,
      maxAddedMoney: "",
      maxEntryFee: "",
      maxEntryFeePercentOfAddedMoney: "",
      maxEntryFeeJackpot: "",
    },
  });

  const onSubmit = (values: CreateClassCodeInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createClassCode(values);
      if (result?.error) setServerError(result.error);
      else
        reset({
          rulePackageId,
          code: "",
          name: "",
          discipline: "",
          division: "",
          isYouth: false,
          isAmateur: false,
          isOpen: false,
          isNonPro: false,
          countsForPoints: true,
          countsForMoney: true,
          maxAddedMoney: "",
          maxEntryFee: "",
          maxEntryFeePercentOfAddedMoney: "",
          maxEntryFeeJackpot: "",
        });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="cc-code">Code</Label>
          <Input id="cc-code" placeholder="e.g. 5300" {...register("code")} />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cc-name">Name</Label>
          <Input id="cc-name" placeholder="e.g. Green Reiner Level 1" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="cc-discipline">Discipline</Label>
          <Input id="cc-discipline" {...register("discipline")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="cc-maxAddedMoney">Max added money ($, optional)</Label>
          <Input
            id="cc-maxAddedMoney"
            inputMode="decimal"
            placeholder="e.g. 500"
            {...register("maxAddedMoney")}
          />
          <FieldError message={errors.maxAddedMoney?.message} />
        </div>
        <div>
          <Label htmlFor="cc-maxEntryFee">Max entry fee ($, flat, optional)</Label>
          <Input
            id="cc-maxEntryFee"
            inputMode="decimal"
            placeholder="e.g. 30"
            {...register("maxEntryFee")}
          />
          <FieldError message={errors.maxEntryFee?.message} />
        </div>
        <div>
          <Label htmlFor="cc-maxEntryFeePercent">
            Or max entry fee (% of added money, optional)
          </Label>
          <Input
            id="cc-maxEntryFeePercent"
            inputMode="decimal"
            placeholder="e.g. 10"
            {...register("maxEntryFeePercentOfAddedMoney")}
          />
          <FieldError message={errors.maxEntryFeePercentOfAddedMoney?.message} />
        </div>
        <div>
          <Label htmlFor="cc-maxEntryFeeJackpot">
            Max entry fee if jackpot ($, optional)
          </Label>
          <Input
            id="cc-maxEntryFeeJackpot"
            inputMode="decimal"
            placeholder="e.g. 50"
            {...register("maxEntryFeeJackpot")}
          />
          <FieldError message={errors.maxEntryFeeJackpot?.message} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-stone-500 dark:text-stone-400">
        These caps power a soft warning on classes linked to this code —
        not enforced, and not an approved NRHA formula. Use either the
        flat entry-fee cap or the percent-of-added-money cap (with an
        optional separate jackpot cap), matching how the Handbook states
        it for this class type.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        {(
          [
            ["isYouth", "Youth"],
            ["isAmateur", "Amateur"],
            ["isOpen", "Open"],
            ["isNonPro", "Non Pro"],
            ["countsForPoints", "Counts for points"],
            ["countsForMoney", "Counts for money"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone-300 accent-brand-700"
              {...register(field)}
            />
            {label}
          </label>
        ))}
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : "Add class code"}
      </Button>
    </form>
  );
}

export function AddEligibilityRuleForm({ rulePackageId }: { rulePackageId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEligibilityRuleInput>({
    resolver: zodResolver(createEligibilityRuleSchema),
    defaultValues: {
      rulePackageId,
      ruleKey: "",
      appliesTo: "",
      field: "",
      operator: "equals",
      value: "",
      severity: "warning",
      message: "",
    },
  });

  const onSubmit = (values: CreateEligibilityRuleInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createEligibilityRule(values);
      if (result?.error) setServerError(result.error);
      else
        reset({
          rulePackageId,
          ruleKey: "",
          appliesTo: "",
          field: "",
          operator: "equals",
          value: "",
          severity: "warning",
          message: "",
        });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {serverError && <Alert>{serverError}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="er-key">Rule key</Label>
          <Input
            id="er-key"
            placeholder="e.g. nrha_non_pro_owner_requirement"
            {...register("ruleKey")}
          />
          <FieldError message={errors.ruleKey?.message} />
        </div>
        <div>
          <Label htmlFor="er-applies">Applies to (comma-separated)</Label>
          <Input id="er-applies" placeholder="e.g. non_pro, youth, or a code like 5300" {...register("appliesTo")} />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Blank = every entry. Otherwise matches an entered class&apos;s linked
            code (exact code, or category: non_pro/youth/amateur/open).
          </p>
        </div>
        <div>
          <Label htmlFor="er-severity">Severity</Label>
          <Select id="er-severity" {...register("severity")}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="blocking">Blocking</option>
            <option value="critical">Critical</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="er-field">Field</Label>
          <Input
            id="er-field"
            placeholder="e.g. horse.ownedByRider"
            {...register("field")}
          />
          <FieldError message={errors.field?.message} />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            One of: rider.age, entry.hasOwner, entry.ownerIsRider,
            horse.ownershipCount, horse.ownedByRider.
          </p>
        </div>
        <div>
          <Label htmlFor="er-operator">Operator</Label>
          <Select id="er-operator" {...register("operator")}>
            {CONDITION_OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="er-value">Value</Label>
          <Input id="er-value" placeholder="e.g. active" {...register("value")} />
        </div>
      </div>
      <div>
        <Label htmlFor="er-message">Message shown to staff</Label>
        <Input
          id="er-message"
          placeholder="e.g. Rider must meet Non Pro ownership requirements."
          {...register("message")}
        />
        <FieldError message={errors.message?.message} />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : "Add eligibility rule"}
      </Button>
    </form>
  );
}
