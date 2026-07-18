"use client";

import { useMemo, useState, useTransition } from "react";
import { groupShowsIntoWeekend } from "@/app/(app)/organizations/[id]/weekends/actions";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import type { ShowStatus } from "@/lib/types";

interface ShowOption {
  id: string;
  name: string;
  status: ShowStatus;
  startDate: string;
  hasEntries: boolean;
  inMultiSlateWeekend: boolean;
}

export function GroupShowsForm({
  organizationId,
  shows,
}: {
  organizationId: string;
  shows: ShowOption[];
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const suggestion = useMemo(() => {
    if (picked.size < 2 || name.trim() !== "") return "";
    const names = shows
      .filter((s) => picked.has(s.id))
      .map((s) => s.name);
    // Offer a shared prefix as a default weekend name (e.g. two "Fire
    // Cracker" slates → "Fire Cracker").
    const first = names[0]?.split(" ") ?? [];
    let i = 0;
    for (; i < first.length; i++) {
      if (!names.every((n) => n.split(" ")[i] === first[i])) break;
    }
    return first.slice(0, i).join(" ").trim();
  }, [picked, name, shows]);

  const submit = () => {
    setError(undefined);
    const finalName = name.trim() || suggestion;
    if (!finalName) {
      setError("Name the circuit.");
      return;
    }
    if (picked.size < 1) {
      setError("Pick the shows that make up this circuit.");
      return;
    }
    startTransition(async () => {
      const result = await groupShowsIntoWeekend({
        organizationId,
        name: finalName,
        showIds: [...picked],
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card className="max-w-2xl space-y-5">
      {error && <Alert>{error}</Alert>}
      <div>
        <Label htmlFor="wkname">Circuit name</Label>
        <Input
          id="wkname"
          placeholder={suggestion || "e.g. Fire Cracker Classic"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label>Slates</Label>
        {shows.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No shows yet — create the slate shows first, then group them.
          </p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2 dark:border-stone-800">
            {shows.map((s) => {
              const blocked = s.hasEntries;
              return (
                <label
                  key={s.id}
                  className={`flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm ${
                    blocked
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                      checked={picked.has(s.id)}
                      disabled={blocked}
                      onChange={() => toggle(s.id)}
                    />
                    <span>{s.name}</span>
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {blocked
                      ? "has entries — can't group"
                      : s.inMultiSlateWeekend
                        ? "in a circuit — will move"
                        : new Date(`${s.startDate}T00:00:00`).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" }
                          )}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Only shows without entries yet can be grouped — set the weekend up
          during show setup, before entries come in.
        </p>
      </div>
      <Button type="button" disabled={isPending || picked.size < 1} onClick={submit}>
        {isPending ? "Creating…" : "Create circuit"}
      </Button>
    </Card>
  );
}
