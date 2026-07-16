"use client";

import { useState, useTransition } from "react";
import { createAqhaStarterPackage } from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

export function CreateAqhaStarterButton({ organizationId }: { organizationId: string }) {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">
        Start from the AQHA Handbook class catalog
      </h2>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
        Creates a draft rule package transcribed from the official AQHA
        Handbook&apos;s Show Rules (SHW) section: the Achievement Awards
        class catalog (SHW805) across Open, Amateur, Select, and Youth
        divisions, plus eligibility rules with their SHW citations (youth
        age, amateur/youth ownership, Select 50+). Codes are internal
        mnemonics — align them with your AQHA results-software codes and
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
            Draft AQHA {year} package created below — open it to review the
            class catalog and eligibility rules before publishing.
          </Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="aqha-year">Year</Label>
          <Input
            id="aqha-year"
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
              const result = await createAqhaStarterPackage(organizationId, year);
              if (result?.error) setError(result.error);
              else setDone(true);
            });
          }}
        >
          {isPending ? "Creating…" : `Create AQHA ${year} starter package`}
        </Button>
      </div>
    </Card>
  );
}
