import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { deleteEntry } from "@/app/(app)/shows/[id]/entries/actions";
import {
  AddEntryClassForm,
  BackNumberControl,
  EntryScratchControls,
  ScratchClassButton,
} from "@/components/show/entry-detail-controls";
import { RemoveButton } from "@/components/remove-button";
import { IssueList } from "@/components/show/issue-badges";
import { Alert, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { loadValidatedEntries } from "@/lib/validate-entries";
import type { Entry, EntryClassRow, Show, ShowClass } from "@/lib/types";

export const metadata = { title: "Entry — ShowRing IQ" };

export default async function EntryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; entryId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, entryId } = await params;
  const { error: flashError } = await searchParams;
  const { supabase } = await requireUser();

  const { data: entry } = await supabase
    .from("entries")
    .select("*")
    .eq("id", entryId)
    .eq("show_id", id)
    .maybeSingle();
  if (!entry) notFound();
  const e = entry as Entry;

  const [
    { data: show },
    { data: entryClasses },
    { data: backNumber },
    { data: allClasses },
    { entries: validatedEntries },
    canEdit,
    canScratch,
    canReinstate,
    canAssignBack,
    canDelete,
  ] = await Promise.all([
    supabase.from("shows").select("status").eq("id", id).maybeSingle(),
    supabase
      .from("entry_classes")
      .select("*, class:classes(id, class_number, name, status)")
      .eq("entry_id", entryId)
      .order("created_at"),
    supabase
      .from("back_numbers")
      .select("number")
      .eq("entry_id", entryId)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id, class_number, name, status")
      .eq("show_id", id)
      .not("status", "in", "(cancelled,archived)")
      .order("display_order"),
    loadValidatedEntries(supabase, id),
    hasOrgPermission(e.organization_id, "entry.edit"),
    hasOrgPermission(e.organization_id, "entry.scratch"),
    hasOrgPermission(e.organization_id, "entry.reinstate"),
    hasOrgPermission(e.organization_id, "entry.assign_back_number"),
    hasOrgPermission(e.organization_id, "entry.delete"),
  ]);

  const showStatus = (show as Pick<Show, "status"> | null)?.status ?? "draft";
  const showEditable = showStatus === "draft" || showStatus === "published";

  const classRows = (entryClasses as unknown as EntryClassRow[]) ?? [];
  const enteredIds = new Set(classRows.map((ec) => ec.class_id));
  const availableClasses =
    (allClasses as Pick<ShowClass, "id" | "class_number" | "name" | "status">[] | null)
      ?.filter((c) => !enteredIds.has(c.id))
      .map((c) => ({ id: c.id, label: `${c.class_number} — ${c.name}` })) ?? [];

  const feeTotal = classRows
    .filter((ec) => ec.status === "entered")
    .reduce((sum, ec) => sum + ec.fee_cents, 0);

  const issues =
    validatedEntries.find((v) => v.entry.id === entryId)?.issues ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/shows/${id}/entries`} className="hover:underline">
            Entries
          </Link>{" "}
          / Entry {e.entry_number}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Entry {e.entry_number} — {e.rider_name} on {e.horse_name}
          </h2>
          {e.status === "scratched" && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              scratched
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {e.owner_name && `Owner: ${e.owner_name}`}
          {e.trainer_name && ` · Trainer: ${e.trainer_name}`}
          {e.notes && ` · ${e.notes}`}
        </p>
      </div>

      {flashError && <Alert>{flashError}</Alert>}
      {!showEditable && (
        <Alert tone="info">
          This show is {showStatus}; the entry is read-only.
        </Alert>
      )}

      {issues.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <h3 className="mb-3 text-base font-semibold">Validation</h3>
          <IssueList issues={issues} />
        </Card>
      )}

      <Card>
        <h3 className="mb-3 text-base font-semibold">Back number</h3>
        <BackNumberControl
          entryId={entryId}
          currentNumber={backNumber?.number ?? null}
          canAssign={canAssignBack && showEditable}
        />
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">
            Classes ({classRows.filter((ec) => ec.status === "entered").length}{" "}
            entered)
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Class fees: <b>{formatCents(feeTotal)}</b>
          </p>
        </div>
        {classRows.length === 0 ? (
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            No classes on this entry yet.
          </p>
        ) : (
          <ul className="mb-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {classRows.map((ec) => (
              <li
                key={ec.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p
                    className={`text-sm font-medium ${
                      ec.status === "scratched"
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : ""
                    }`}
                  >
                    {ec.class ? (
                      <Link
                        href={`/shows/${id}/classes/${ec.class.id}`}
                        className="hover:underline"
                      >
                        {ec.class.class_number} — {ec.class.name}
                      </Link>
                    ) : (
                      "Unknown class"
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatCents(ec.fee_cents)}
                    {ec.status === "scratched" &&
                      ` · scratched${ec.scratch_reason ? `: ${ec.scratch_reason}` : ""}`}
                  </p>
                </div>
                {showEditable && (
                  <div className="flex items-center gap-2">
                    <ScratchClassButton
                      entryClassId={ec.id}
                      status={ec.status}
                      canScratch={canScratch}
                      canReinstate={canReinstate}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && showEditable && (
          <AddEntryClassForm
            entryId={entryId}
            availableClasses={availableClasses}
          />
        )}
      </Card>

      {showEditable && (
        <Card>
          <h3 className="mb-3 text-base font-semibold">Entry actions</h3>
          <div className="flex flex-wrap items-center gap-3">
            <EntryScratchControls
              entryId={entryId}
              status={e.status}
              canScratch={canScratch}
              canReinstate={canReinstate}
            />
            {canDelete && (
              <RemoveButton
                action={deleteEntry.bind(null, entryId)}
                label="Delete entry"
                pendingLabel="Deleting…"
                confirmText={`Permanently delete entry ${e.entry_number}? Prefer scratching — deletion removes the entry from records entirely and cannot be undone.`}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Scratching keeps the entry in reports and association exports
            (NRHA requires scratched entries in the results file). Deletion is
            for data-entry mistakes only.
          </p>
        </Card>
      )}
    </div>
  );
}
