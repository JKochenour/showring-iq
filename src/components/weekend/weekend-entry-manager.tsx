"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWeekendRiderClasses } from "@/app/(app)/organizations/[id]/weekends/actions";
import { Alert, Button, Card } from "@/components/ui";

interface SlateClass {
  id: string;
  classNumber: number;
  name: string;
  feeCents: number;
  concurrentGroupId: string | null;
}
interface Slate {
  showId: string;
  name: string;
  classes: SlateClass[];
}
interface EnteredClass {
  classId: string;
  entryClassId: string;
  status: string;
}
interface Exhibitor {
  riderPersonId: string;
  riderName: string;
  entered: Record<string, EnteredClass[]>;
}
interface Horse {
  horseId: string;
  horseName: string;
  backNumber: number | null;
  exhibitors: Exhibitor[];
}

interface Row {
  classNumber: number;
  name: string;
  perSlate: Map<string, { classId: string }>;
}

const key = (showId: string, classId: string) => `${showId}::${classId}`;

export function WeekendEntryManager({
  weekendId,
  slates,
  horses,
}: {
  weekendId: string;
  slates: Slate[];
  horses: Horse[];
}) {
  const [query, setQuery] = useState("");

  // Class rows matched across slates by name — one row spans the weekend.
  const rows = useMemo(() => {
    const byName = new Map<string, Row>();
    for (const slate of slates) {
      for (const c of slate.classes) {
        const k = c.name.trim().toLowerCase();
        let row = byName.get(k);
        if (!row) {
          row = { classNumber: c.classNumber, name: c.name, perSlate: new Map() };
          byName.set(k, row);
        }
        row.perSlate.set(slate.showId, { classId: c.id });
      }
    }
    return [...byName.values()].sort((a, b) => a.classNumber - b.classNumber);
  }, [slates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return horses;
    return horses.filter(
      (h) =>
        String(h.backNumber ?? "").includes(q) ||
        h.horseName.toLowerCase().includes(q) ||
        h.exhibitors.some((e) => e.riderName.toLowerCase().includes(q))
    );
  }, [query, horses]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by back number, horse, or rider…"
        className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
      />

      {horses.length === 0 ? (
        <Alert tone="info">No horses are entered in this circuit yet.</Alert>
      ) : filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-stone-500 dark:text-stone-400">
          No horse, rider, or back number matches “{query}”.
        </p>
      ) : (
        filtered.map((horse) => (
          <Card key={horse.horseId} className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="rounded-md bg-brand-700 px-2.5 py-1 font-mono text-sm font-semibold text-white">
                #{horse.backNumber ?? "—"}
              </span>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                {horse.horseName}
              </h3>
              <span className="text-sm text-stone-500 dark:text-stone-400">
                {horse.exhibitors.length} exhibitor{horse.exhibitors.length === 1 ? "" : "s"}
              </span>
            </div>
            {horse.exhibitors.map((ex) => (
              <ExhibitorEditor
                key={ex.riderPersonId}
                weekendId={weekendId}
                horseId={horse.horseId}
                slates={slates}
                rows={rows}
                exhibitor={ex}
              />
            ))}
          </Card>
        ))
      )}
    </div>
  );
}

function ExhibitorEditor({
  weekendId,
  horseId,
  slates,
  rows,
  exhibitor,
}: {
  weekendId: string;
  horseId: string;
  slates: Slate[];
  rows: Row[];
  exhibitor: Exhibitor;
}) {
  const router = useRouter();

  // Initial checked set + scratched (locked) set from current entries.
  const { initial, scratched } = useMemo(() => {
    const init = new Set<string>();
    const scr = new Set<string>();
    for (const [showId, ecs] of Object.entries(exhibitor.entered)) {
      for (const ec of ecs) {
        init.add(key(showId, ec.classId));
        if (ec.status === "scratched") scr.add(key(showId, ec.classId));
      }
    }
    return { initial: init, scratched: scr };
  }, [exhibitor.entered]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const k of selected) if (!initial.has(k)) return true;
    return false;
  }, [selected, initial]);

  const toggle = (showId: string, classId: string) => {
    const k = key(showId, classId);
    if (scratched.has(k)) return; // scratched classes stay for results
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await saveWeekendRiderClasses({
        weekendId,
        horseId,
        riderPersonId: exhibitor.riderPersonId,
        slates: slates.map((slate) => ({
          showId: slate.showId,
          classIds: slate.classes
            .filter((c) => selected.has(key(slate.showId, c.id)))
            .map((c) => c.id),
        })),
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
      <p className="mb-3 text-sm font-semibold text-stone-800 dark:text-stone-100">
        {exhibitor.riderName}
      </p>
      {error && <Alert>{error}</Alert>}
      {saved && !dirty && <Alert tone="success">Saved.</Alert>}
      <div className="overflow-x-auto rounded-md border border-stone-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left dark:border-stone-800 dark:bg-stone-900/50">
              <th className="px-3 py-2 font-medium">Class</th>
              {slates.map((slate) => (
                <th key={slate.showId} className="px-3 py-2 text-center font-medium">
                  {slate.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-stone-100 last:border-0 dark:border-stone-800/60"
              >
                <td className="px-3 py-1.5">
                  <span className="mr-2 font-mono text-xs text-stone-400">{row.classNumber}</span>
                  {row.name}
                </td>
                {slates.map((slate) => {
                  const cell = row.perSlate.get(slate.showId);
                  if (!cell)
                    return (
                      <td key={slate.showId} className="px-3 py-1.5 text-center">
                        <span className="text-stone-300 dark:text-stone-700">—</span>
                      </td>
                    );
                  const k = key(slate.showId, cell.classId);
                  const isScratched = scratched.has(k);
                  return (
                    <td key={slate.showId} className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-stone-300 accent-brand-700 disabled:opacity-50"
                        checked={selected.has(k)}
                        disabled={isScratched}
                        onChange={() => toggle(slate.showId, cell.classId)}
                        aria-label={`${row.name} — ${slate.name}`}
                      />
                      {isScratched && (
                        <span className="ml-1 align-middle text-[10px] uppercase text-amber-600 dark:text-amber-400">
                          scr
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="md" disabled={!dirty || isPending} onClick={save}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {dirty && (
          <button
            type="button"
            className="text-sm text-stone-500 hover:underline"
            onClick={() => {
              setSelected(new Set(initial));
              setError(undefined);
            }}
          >
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-stone-400">
          Check to add · uncheck to drop · scratched classes stay for results
        </span>
      </div>
    </div>
  );
}
