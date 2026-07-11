"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkDeleteHorses } from "@/app/(app)/organizations/[id]/horses/actions";
import { Alert, Button, Card } from "@/components/ui";

export type HorseRow = {
  id: string;
  registeredName: string;
  barnName: string | null;
  details: string;
  registrations: string;
  owners: string;
};

export function HorsesTable({
  organizationId,
  rows,
  canDelete,
}: {
  organizationId: string;
  rows: HorseRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [summary, setSummary] = useState<{ deleted: number; failed: number; messages: string[] }>();
  const [isPending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  const selectedNames = useMemo(
    () => rows.filter((r) => selected.has(r.id)).map((r) => r.registeredName),
    [rows, selected]
  );

  function handleDelete() {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Permanently delete ${selected.size} horse${selected.size === 1 ? "" : "s"}? This cannot be undone.\n\n${selectedNames.slice(0, 10).join(", ")}${selectedNames.length > 10 ? `, +${selectedNames.length - 10} more` : ""}`
    );
    if (!confirmed) return;

    setError(undefined);
    setSummary(undefined);
    startTransition(async () => {
      const result = await bulkDeleteHorses(organizationId, Array.from(selected));
      if (!("deleted" in result)) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      const messages = result.results.filter((r) => r.status === "error").map((r) => `${r.name}: ${r.message}`);
      setSummary({ deleted: result.deleted, failed: result.failed, messages });
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      {canDelete && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-stone-500 dark:text-stone-400">
            {selected.size > 0 ? `${selected.size} selected` : "Select rows to bulk-delete"}
          </span>
          <Button
            variant="danger"
            disabled={selected.size === 0 || isPending}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Delete selected"}
          </Button>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {summary && (
        <div className="mb-3">
          <Alert tone={summary.failed > 0 ? "info" : "success"}>
            Deleted {summary.deleted} horse{summary.deleted === 1 ? "" : "s"}.
            {summary.failed > 0 && (
              <>
                {" "}
                {summary.failed} couldn&apos;t be deleted: {summary.messages.join("; ")}
              </>
            )}
          </Alert>
        </div>
      )}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                {canDelete && (
                  <th className="w-8 py-2 pr-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all horses"
                    />
                  </th>
                )}
                <th className="py-2 pr-4 font-medium">Horse</th>
                <th className="py-2 pr-4 font-medium">Details</th>
                <th className="py-2 pr-4 font-medium">Registrations</th>
                <th className="py-2 font-medium">Owners</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {rows.map((horse) => (
                <tr key={horse.id} className={selected.has(horse.id) ? "bg-brand-50/50 dark:bg-brand-950/20" : undefined}>
                  {canDelete && (
                    <td className="py-3 pr-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                        checked={selected.has(horse.id)}
                        onChange={() => toggle(horse.id)}
                        aria-label={`Select ${horse.registeredName}`}
                      />
                    </td>
                  )}
                  <td className="py-3 pr-4">
                    <Link
                      href={`/organizations/${organizationId}/horses/${horse.id}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-500"
                    >
                      {horse.registeredName}
                    </Link>
                    {horse.barnName && (
                      <p className="text-xs text-stone-500 dark:text-stone-400">“{horse.barnName}”</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-stone-500 dark:text-stone-400">{horse.details}</td>
                  <td className="py-3 pr-4 text-stone-500 dark:text-stone-400">{horse.registrations}</td>
                  <td className="py-3 text-stone-500 dark:text-stone-400">{horse.owners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
