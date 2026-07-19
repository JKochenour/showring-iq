"use client";

import { useState, useTransition } from "react";
import { createNrhaStarterPackage } from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

export function CreateNrhaStarterButton({ organizationId }: { organizationId: string }) {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">Create an NRHA rule package</h2>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
        Creates an empty draft NRHA package for the year. Class codes are{" "}
        <strong>not</strong> included — NRHA&apos;s numeric codes come from
        member-only Handbook and ReinerSuite access, so nothing is scraped or
        shipped here. Load your own official class-code list through the
        package&apos;s <strong>Import class codes</strong> page, then add
        eligibility rules scoped to those codes.
      </p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mb-3">
          <Alert tone="success">
            Draft NRHA {year} package created below — open it and import your
            class-code list to fill it in.
          </Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="nrha-year">Year</Label>
          <Input
            id="nrha-year"
            type="number"
            className="w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => {
            setError(undefined);
            setDone(false);
            startTransition(async () => {
              const result = await createNrhaStarterPackage(organizationId, year);
              if (result?.error) setError(result.error);
              else setDone(true);
            });
          }}
        >
          {isPending ? "Creating…" : `Create NRHA ${year} starter package`}
        </Button>
      </div>
    </Card>
  );
}
