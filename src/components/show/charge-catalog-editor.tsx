"use client";

import { useState, useTransition } from "react";
import { updateChargeCatalog } from "@/app/(app)/shows/actions";
import { CHARGE_CATEGORY_SUGGESTIONS } from "@/lib/validation/billing";
import { Alert, Button, Input } from "@/components/ui";

export type ChargeCatalogRow = {
  label: string;
  category: string;
  amount: string;
};

/** Common things a show sells over the counter. Prices deliberately left
 * blank — they differ every year and every venue. */
const CATALOG_STARTER_SET: ChargeCatalogRow[] = [
  { label: "Shavings", category: "Shavings", amount: "" },
  { label: "Ice", category: "Ice", amount: "" },
  { label: "Non-shown horse stall", category: "Stabling", amount: "" },
  { label: "Tack stall", category: "Stabling", amount: "" },
];

export function ChargeCatalogEditor({
  showId,
  items,
  canEdit,
}: {
  showId: string;
  items: ChargeCatalogRow[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ChargeCatalogRow[]>(items);

  const update = (index: number, patch: Partial<ChargeCatalogRow>) => {
    setSaved(false);
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateChargeCatalog({ showId, items: rows });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">Price list saved.</Alert>}
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Things the office sells over the counter — shavings, ice, a tack
        stall. Setting a price here means it is typed once, at setup, instead
        of once per exhibitor: on a bill you pick the item, enter a quantity,
        and the total is worked out for you.{" "}
        <strong>Nothing here is charged automatically</strong> — that is what
        standard per-entry charges above are for. Any price can still be
        changed on the individual bill.
      </p>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">
                  Item
                </label>
                <Input
                  value={row.label}
                  disabled={!canEdit}
                  placeholder="e.g. Shavings"
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </div>
              <div className="min-w-32 flex-1">
                <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">
                  Category
                </label>
                <Input
                  value={row.category}
                  disabled={!canEdit}
                  list="charge-catalog-categories"
                  placeholder="Other"
                  onChange={(e) => update(i, { category: e.target.value })}
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">
                  Price each ($)
                </label>
                <Input
                  value={row.amount}
                  disabled={!canEdit}
                  placeholder="0.00"
                  onChange={(e) => update(i, { amount: e.target.value })}
                />
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSaved(false);
                    setRows((prev) => prev.filter((_, x) => x !== i));
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <datalist id="charge-catalog-categories">
            {CHARGE_CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSaved(false);
              setRows((prev) => [
                ...prev,
                { label: "", category: "", amount: "" },
              ]);
            }}
          >
            Add item
          </Button>
          {rows.length === 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSaved(false);
                setRows(CATALOG_STARTER_SET);
              }}
            >
              Load common items
            </Button>
          )}
          <Button type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save price list"}
          </Button>
        </div>
      )}
    </div>
  );
}
