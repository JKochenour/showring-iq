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
      <h2 className="mb-2 text-base font-semibold">Start from NRHA&apos;s public class list</h2>
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Creates a draft rule package with common local-show class names and
        eligibility flags (Open, Non Pro, Green Reiner, Youth, etc.) from
        NRHA&apos;s public category taxonomy. Class codes are seeded as
        placeholders — confirm the real numeric codes from your NRHA
        Handbook or ReinerSuite access before publishing. This does not scrape
        or copy anything from NRHA&apos;s member-only content.
      </p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mb-3">
          <Alert tone="success">
            Draft NRHA {year} package created below — open it to review class codes and
            confirm the real ones before publishing.
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
