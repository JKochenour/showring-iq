"use client";

import { useState, useTransition } from "react";
import { setRiderLevel } from "@/app/(app)/shows/[id]/results/actions";
import { Select } from "@/components/ui";

export function RiderLevelSelect({
  entryClassId,
  showId,
  classId,
  level,
  disabled,
}: {
  entryClassId: string;
  showId: string;
  classId: string;
  level: 1 | 2 | 3 | 4 | null;
  disabled: boolean;
}) {
  const [value, setValue] = useState(level ? String(level) : "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div>
      <Select
        className="w-20"
        value={value}
        disabled={disabled || isPending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          setError(undefined);
          startTransition(async () => {
            const result = await setRiderLevel(
              { entryClassId, level: next ? (Number(next) as 1 | 2 | 3 | 4) : null },
              showId,
              classId
            );
            if (result?.error) setError(result.error);
          });
        }}
      >
        <option value="">—</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
      </Select>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
