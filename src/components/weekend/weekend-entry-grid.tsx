"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createWeekendEntry } from "@/app/(app)/organizations/[id]/weekends/actions";
import { formatCents } from "@/lib/money";
import { Alert, Button, Card, Label } from "@/components/ui";
import { Combobox } from "@/components/combobox";

interface PersonOption {
  id: string;
  label: string;
}

interface SlateClass {
  id: string;
  classNumber: number;
  name: string;
  feeCents: number;
  showId: string;
}

interface Slate {
  showId: string;
  name: string;
  classes: SlateClass[];
}

const key = (showId: string, classId: string) => `${showId}::${classId}`;

export function WeekendEntryGrid({
  weekendId,
  organizationId,
  riders,
  owners,
  payees,
  horses,
  slates,
}: {
  weekendId: string;
  organizationId: string;
  riders: PersonOption[];
  owners: PersonOption[];
  /** Anyone in the org can receive winning checks (owner/exhibitor/other). */
  payees: PersonOption[];
  horses: { id: string; label: string }[];
  slates: Slate[];
}) {
  const [horseId, setHorseId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [billTo, setBillTo] = useState<"rider" | "owner">("rider");
  const [ownerId, setOwnerId] = useState("");
  const [payeeMode, setPayeeMode] = useState<"default" | "other">("default");
  const [payeeId, setPayeeId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // Match classes across slates by name so each row spans the weekend.
  const rows = useMemo(() => {
    const byName = new Map<
      string,
      {
        classNumber: number;
        name: string;
        perSlate: Map<string, { classId: string; feeCents: number }>;
      }
    >();
    for (const slate of slates) {
      for (const c of slate.classes) {
        const k = c.name.trim().toLowerCase();
        let row = byName.get(k);
        if (!row) {
          row = { classNumber: c.classNumber, name: c.name, perSlate: new Map() };
          byName.set(k, row);
        }
        row.perSlate.set(slate.showId, { classId: c.id, feeCents: c.feeCents });
      }
    }
    return [...byName.values()].sort((a, b) => a.classNumber - b.classNumber);
  }, [slates]);

  const toggle = (showId: string, classId: string) => {
    const next = new Set(selected);
    const k = key(showId, classId);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const toggleSlateAll = (slate: Slate, on: boolean) => {
    const next = new Set(selected);
    for (const c of slate.classes) {
      const k = key(slate.showId, c.id);
      if (on) next.add(k);
      else next.delete(k);
    }
    setSelected(next);
  };

  const { feeCents, runCount } = useMemo(() => {
    let fee = 0;
    let runs = 0;
    for (const row of rows) {
      for (const [showId, cell] of row.perSlate) {
        if (selected.has(key(showId, cell.classId))) {
          fee += cell.feeCents;
          runs += 1;
        }
      }
    }
    return { feeCents: fee, runCount: runs };
  }, [rows, selected]);

  const submit = () => {
    setError(undefined);
    setSaved(undefined);
    if (!horseId) return setError("Choose a horse.");
    if (!riderId) return setError("Choose a rider.");
    if (billTo === "owner" && !ownerId) return setError("Choose the owner to bill.");
    if (payeeMode === "other" && !payeeId)
      return setError("Choose who receives winning checks.");
    if (runCount === 0) return setError("Check at least one class in a slate.");

    const payload = {
      weekendId,
      horseId,
      riderPersonId: riderId,
      billTo,
      ownerPersonId: billTo === "owner" ? ownerId : "",
      payeePersonId: payeeMode === "other" ? payeeId : "",
      slates: slates.map((slate) => ({
        showId: slate.showId,
        classIds: slate.classes
          .filter((c) => selected.has(key(slate.showId, c.id)))
          .map((c) => c.id),
      })),
    };

    const horseLabel = horses.find((h) => h.id === horseId)?.label ?? "horse";
    const riderLabel = riders.find((r) => r.id === riderId)?.label ?? "rider";

    startTransition(async () => {
      const result = await createWeekendEntry(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Reset for the next horse — the office enters many in a row.
      setSaved(`Entered ${horseLabel} · ${riderLabel} in ${runCount} run${runCount === 1 ? "" : "s"}.`);
      setHorseId("");
      setRiderId("");
      setOwnerId("");
      setPayeeMode("default");
      setPayeeId("");
      setSelected(new Set());
    });
  };

  return (
    <Card className="space-y-5">
      {error && <Alert>{error}</Alert>}
      {saved && (
        <Alert tone="success">
          {saved}{" "}
          <Link
            href={`/organizations/${organizationId}/weekends/${weekendId}`}
            className="underline"
          >
            Back to weekend
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="wk-horse">Horse</Label>
          <Combobox
            id="wk-horse"
            options={horses}
            value={horseId}
            onChange={setHorseId}
            placeholder="Choose a horse…"
          />
        </div>
        <div>
          <Label htmlFor="wk-rider">Rider</Label>
          <Combobox
            id="wk-rider"
            options={riders}
            value={riderId}
            onChange={setRiderId}
            placeholder="Choose a rider…"
          />
        </div>
      </div>

      <div>
        <Label>Bill this portion to</Label>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-brand-700"
              checked={billTo === "rider"}
              onChange={() => setBillTo("rider")}
            />
            Rider
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-brand-700"
              checked={billTo === "owner"}
              onChange={() => setBillTo("owner")}
            />
            Owner
          </label>
          {billTo === "owner" && (
            <div className="min-w-56">
              <Combobox
                options={owners}
                value={ownerId}
                onChange={setOwnerId}
                placeholder="Choose the owner…"
              />
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          The horse&apos;s once-per-weekend office/stall/drug lands on whoever
          signs it up here; each run&apos;s class/video/photo bills the same
          way.
        </p>
      </div>

      <div>
        <Label>Winning checks to</Label>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-brand-700"
              checked={payeeMode === "default"}
              onChange={() => setPayeeMode("default")}
            />
            Default (owner, then rider)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-brand-700"
              checked={payeeMode === "other"}
              onChange={() => setPayeeMode("other")}
            />
            Someone else
          </label>
          {payeeMode === "other" && (
            <div className="min-w-56">
              <Combobox
                options={payees}
                value={payeeId}
                onChange={setPayeeId}
                placeholder="Choose the payee…"
              />
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Separate from who pays the bill — the payee needs a verified W-9 on
          file before winning checks are written.
        </p>
      </div>

      <div>
        <Label>Classes by slate</Label>
        <div className="overflow-x-auto rounded-md border border-stone-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left dark:border-stone-800 dark:bg-stone-900/50">
                <th className="px-3 py-2 font-medium">Class</th>
                {slates.map((slate) => (
                  <th key={slate.showId} className="px-3 py-2 text-center font-medium">
                    <div>{slate.name}</div>
                    <div className="mt-0.5 flex justify-center gap-2 text-xs font-normal">
                      <button
                        type="button"
                        className="text-brand-700 hover:underline dark:text-brand-400"
                        onClick={() => toggleSlateAll(slate, true)}
                      >
                        all
                      </button>
                      <button
                        type="button"
                        className="text-stone-500 hover:underline"
                        onClick={() => toggleSlateAll(slate, false)}
                      >
                        none
                      </button>
                    </div>
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
                    <span className="mr-2 font-mono text-xs text-stone-400">
                      {row.classNumber}
                    </span>
                    {row.name}
                  </td>
                  {slates.map((slate) => {
                    const cell = row.perSlate.get(slate.showId);
                    return (
                      <td key={slate.showId} className="px-3 py-1.5 text-center">
                        {cell ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                            checked={selected.has(key(slate.showId, cell.classId))}
                            onChange={() => toggle(slate.showId, cell.classId)}
                            aria-label={`${row.name} — ${slate.name}`}
                          />
                        ) : (
                          <span className="text-stone-300 dark:text-stone-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={slates.length + 1}
                    className="px-3 py-4 text-center text-stone-500 dark:text-stone-400"
                  >
                    No classes on the slates yet — add classes to the shows first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {runCount > 0 && (
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {runCount} run{runCount === 1 ? "" : "s"} · class fees{" "}
            <b>{formatCents(feeCents)}</b>{" "}
            <span className="text-stone-500 dark:text-stone-400">
              (video/photography added per run)
            </span>
          </p>
        )}
      </div>

      <Button type="button" disabled={isPending} onClick={submit}>
        {isPending ? "Entering…" : "Enter"}
      </Button>
    </Card>
  );
}
