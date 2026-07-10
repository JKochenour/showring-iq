"use client";

import { useState, useTransition } from "react";
import { createExhibitorEntry } from "@/app/(exhibitor)/exhibitor/[orgId]/actions";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { formatCents } from "@/lib/money";

export interface EntryClassOption {
  id: string;
  classNumber: number;
  name: string;
  feeCents: number;
  eligible: boolean;
  reasons: string[];
}

export function ExhibitorEntryForm({
  organizationId,
  showId,
  horses,
  classes,
}: {
  organizationId: string;
  showId: string;
  horses: ComboboxOption[];
  classes: EntryClassOption[];
}) {
  const [horseId, setHorseId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(classes.filter((c) => c.eligible).map((c) => c.id))
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, eligible: boolean) {
    if (!eligible) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = classes
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + c.feeCents, 0);

  return (
    <Card>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mb-4">
        <Label htmlFor="horse">Horse</Label>
        <Combobox
          id="horse"
          options={horses}
          value={horseId}
          onChange={setHorseId}
          placeholder="Choose a horse…"
        />
      </div>

      <Label>Classes</Label>
      <div className="max-h-96 space-y-1 overflow-y-auto rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        {classes.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No classes available yet.</p>
        )}
        {classes.map((c) => (
          <div
            key={c.id}
            className={`rounded px-2 py-1.5 text-sm ${c.eligible ? "hover:bg-zinc-50 dark:hover:bg-zinc-800" : "opacity-60"}`}
          >
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 accent-emerald-700 disabled:opacity-50"
                  checked={selected.has(c.id)}
                  disabled={!c.eligible}
                  onChange={() => toggle(c.id, c.eligible)}
                />
                <span className="font-mono text-xs text-zinc-500">{c.classNumber}</span>
                {c.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">{formatCents(c.feeCents)}</span>
            </label>
            {!c.eligible && c.reasons.length > 0 && (
              <p className="ml-6 mt-0.5 text-xs text-red-600 dark:text-red-400">
                ✕ {c.reasons.join("; ")}
              </p>
            )}
          </div>
        ))}
      </div>
      {total > 0 && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Total fees: <b>{formatCents(total)}</b>
        </p>
      )}

      <div className="mt-4">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button
        type="button"
        className="mt-4"
        disabled={isPending || !horseId || selected.size === 0}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await createExhibitorEntry({
              organizationId,
              showId,
              horseId,
              classIds: [...selected],
              notes,
            });
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Submitting…" : "Submit entry"}
      </Button>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Fees shown are due at the show — this doesn&apos;t process payment.
      </p>
    </Card>
  );
}
