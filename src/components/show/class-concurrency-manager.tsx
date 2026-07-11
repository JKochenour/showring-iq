"use client";

import { useState, useTransition } from "react";
import { updateClassConcurrency } from "@/app/(app)/shows/[id]/classes/actions";
import { Alert, Button, Card } from "@/components/ui";

export function ClassConcurrencyManager({
  classId,
  otherClasses,
  currentlyConcurrentWith,
  editable,
}: {
  classId: string;
  otherClasses: { id: string; classNumber: number; name: string }[];
  currentlyConcurrentWith: string[];
  editable: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentlyConcurrentWith)
  );
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setSaved(false);
  };

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateClassConcurrency(classId, [...selected]);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold">Runs concurrent with</h3>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        Classes checked here share one physical run with this class: one
        draw, one gate status, and a score entered once applies to all of
        them automatically. Placings are still calculated independently per
        class.
      </p>
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}
      {otherClasses.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No other classes in this show yet.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {otherClasses.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`concurrent-${c.id}`}
                className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                checked={selected.has(c.id)}
                disabled={!editable || isPending}
                onChange={() => toggle(c.id)}
              />
              <label htmlFor={`concurrent-${c.id}`} className="text-sm">
                {c.classNumber} — {c.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <Button disabled={isPending} onClick={save}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      )}
    </Card>
  );
}
