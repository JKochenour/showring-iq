"use client";

import { useState, useTransition } from "react";
import {
  addClassAffiliation,
  updateClassAffiliation,
  removeClassAffiliation,
} from "@/app/(app)/shows/[id]/classes/actions";
import { Button, Card } from "@/components/ui";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import type { ClassAffiliationRow } from "@/lib/types";
import type { ClassCodeAffiliationMeta } from "@/lib/rule-package-options";

/**
 * Multiple class_affiliations rows for a single class — lets one class
 * count for several associations at once (CLAUDE.md: NRHA code
 * counts for money+points, EPRHA code counts for year-end). The
 * legacy single class_code_id picker on the class form still works;
 * marking a row here "primary" keeps that legacy field in sync.
 */
export function ClassAffiliationsManager({
  classId,
  affiliations,
  classCodeOptions,
  codeMeta,
  editable,
}: {
  classId: string;
  affiliations: ClassAffiliationRow[];
  classCodeOptions: ComboboxOption[];
  codeMeta: ClassCodeAffiliationMeta[];
  editable: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [countsForMoney, setCountsForMoney] = useState(true);
  const [countsForPoints, setCountsForPoints] = useState(true);
  const [countsForYearEnd, setCountsForYearEnd] = useState(false);
  const [isPrimary, setIsPrimary] = useState(affiliations.length === 0);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const linkedCodeIds = new Set(affiliations.map((a) => a.association_class_code_id));
  const availableOptions = classCodeOptions.filter((o) => !linkedCodeIds.has(o.id));
  const metaById = new Map(codeMeta.map((m) => [m.id, m]));

  const onSelectCode = (id: string) => {
    setSelected(id);
    const meta = metaById.get(id);
    if (meta) {
      setCountsForMoney(meta.countsForMoney);
      setCountsForPoints(meta.countsForPoints);
    }
  };

  const onAdd = () => {
    if (!selected) return;
    setError(undefined);
    startTransition(async () => {
      const result = await addClassAffiliation({
        classId,
        associationClassCodeId: selected,
        countsForMoney,
        countsForPoints,
        countsForYearEnd,
        isPrimary,
      });
      if (result?.error) setError(result.error);
      else {
        setSelected("");
        setCountsForYearEnd(false);
        setIsPrimary(false);
      }
    });
  };

  const onToggleFlag = (
    aff: ClassAffiliationRow,
    field: "counts_for_money" | "counts_for_points" | "counts_for_year_end" | "is_primary",
    value: boolean
  ) => {
    setError(undefined);
    startTransition(async () => {
      const result = await updateClassAffiliation({
        classAffiliationId: aff.id,
        countsForMoney: field === "counts_for_money" ? value : aff.counts_for_money,
        countsForPoints: field === "counts_for_points" ? value : aff.counts_for_points,
        countsForYearEnd: field === "counts_for_year_end" ? value : aff.counts_for_year_end,
        isPrimary: field === "is_primary" ? value : aff.is_primary,
      });
      if (result?.error) setError(result.error);
    });
  };

  const onRemove = (id: string, label: string) => {
    if (!window.confirm(`Remove the ${label} affiliation from this class?`)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await removeClassAffiliation(id);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold">Association affiliations</h3>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        One class can count for several associations at once, each with its
        own code and its own eligibility rules — e.g. an NRHA code that
        counts for money and points, plus an EPRHA code that only counts
        toward year-end. The primary affiliation drives the legacy
        &quot;Rule package class code&quot; field below and the NRHA export
        fallback when no NRHA affiliation is linked.
      </p>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {affiliations.length === 0 ? (
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          No affiliations linked yet.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-stone-200 dark:divide-stone-800">
          {affiliations.map((a) => {
            const pkg = a.code?.rule_package;
            const label = a.code
              ? `${pkg?.association?.name ?? "?"} ${a.code.code} — ${a.code.name}`
              : "Unknown code";
            return (
              <li key={a.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {label}
                    {a.is_primary && (
                      <span className="ml-2 inline-block rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                        primary
                      </span>
                    )}
                  </p>
                  {editable && (
                    <Button
                      variant="danger"
                      disabled={isPending}
                      onClick={() => onRemove(a.id, label)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-stone-500 dark:text-stone-400">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={a.counts_for_money}
                      disabled={!editable || isPending}
                      onChange={(e) => onToggleFlag(a, "counts_for_money", e.target.checked)}
                    />
                    Money
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={a.counts_for_points}
                      disabled={!editable || isPending}
                      onChange={(e) => onToggleFlag(a, "counts_for_points", e.target.checked)}
                    />
                    Points
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={a.counts_for_year_end}
                      disabled={!editable || isPending}
                      onChange={(e) => onToggleFlag(a, "counts_for_year_end", e.target.checked)}
                    />
                    Year-end
                  </label>
                  {!a.is_primary && (
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={a.is_primary}
                        disabled={!editable || isPending}
                        onChange={(e) => onToggleFlag(a, "is_primary", e.target.checked)}
                      />
                      Make primary
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <div className="space-y-2 border-t border-stone-200 pt-4 dark:border-stone-800">
          <div className="min-w-[220px]">
            <Combobox
              options={availableOptions}
              value={selected}
              onChange={onSelectCode}
              placeholder="Select a class code…"
              emptyText="No unlinked codes — add one under Organization → Rule Packages"
              clearable
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={countsForMoney}
                onChange={(e) => setCountsForMoney(e.target.checked)}
              />
              Counts for money
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={countsForPoints}
                onChange={(e) => setCountsForPoints(e.target.checked)}
              />
              Counts for points
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={countsForYearEnd}
                onChange={(e) => setCountsForYearEnd(e.target.checked)}
              />
              Counts for year-end
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Primary
            </label>
          </div>
          <Button disabled={!selected || isPending} onClick={onAdd}>
            {isPending ? "Adding…" : "Add affiliation"}
          </Button>
        </div>
      )}
    </Card>
  );
}
