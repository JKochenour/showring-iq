"use client";

import { useState, useTransition } from "react";
import { createAphaStarterPackage } from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

export function CreateAphaStarterButton({ organizationId }: { organizationId: string }) {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">
        Start from the APHA Rule Book class catalog
      </h2>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
        Creates a draft rule package transcribed from the official APHA Rule
        Book: the approved-events catalog (SC-190.A) and halter slate
        (SC-175.M) across Open, Amateur, Masters (45+), Novice Amateur,
        Youth, Novice Youth, Walk-Trot, and Green divisions, plus
        eligibility rules with their rule citations (youth age YP-010,
        amateur AM-010, amateur/youth ownership AM-020/YP-015). APHA
        publishes class names only — codes are internal mnemonics; align
        them with the APHA Performance Department&apos;s results format and
        review every rule before publishing.
      </p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mb-3">
          <Alert tone="success">
            Draft APHA {year} package created below — open it to review the
            class catalog and eligibility rules before publishing.
          </Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="apha-year">Year</Label>
          <Input
            id="apha-year"
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
              const result = await createAphaStarterPackage(organizationId, year);
              if (result?.error) setError(result.error);
              else setDone(true);
            });
          }}
        >
          {isPending ? "Creating…" : `Create APHA ${year} starter package`}
        </Button>
      </div>
    </Card>
  );
}
