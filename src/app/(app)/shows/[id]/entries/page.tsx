import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { BackNumberRow, Entry, EntryClassRow, Show } from "@/lib/types";

export const metadata = { title: "Entries — ShowRing IQ" };

export default async function EntriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id" | "status">;

  const [{ data: entries }, { data: entryClasses }, { data: backNumbers }, canCreate] =
    await Promise.all([
      supabase
        .from("entries")
        .select("*")
        .eq("show_id", id)
        .order("entry_number"),
      supabase
        .from("entry_classes")
        .select("entry_id, status, fee_cents")
        .eq("show_id", id),
      supabase.from("back_numbers").select("entry_id, number").eq("show_id", id),
      hasOrgPermission(s.organization_id, "entry.create"),
    ]);

  const rows = (entries as Entry[]) ?? [];
  const showEditable = s.status === "draft" || s.status === "published";

  const classStats = new Map<string, { entered: number; scratched: number; feeCents: number }>();
  for (const ec of (entryClasses as Pick<EntryClassRow, "entry_id" | "status" | "fee_cents">[]) ?? []) {
    const stat =
      classStats.get(ec.entry_id) ?? { entered: 0, scratched: 0, feeCents: 0 };
    if (ec.status === "entered") {
      stat.entered += 1;
      stat.feeCents += ec.fee_cents;
    } else {
      stat.scratched += 1;
    }
    classStats.set(ec.entry_id, stat);
  }

  const backByEntry = new Map<string, number>();
  for (const bn of (backNumbers as Pick<BackNumberRow, "entry_id" | "number">[]) ?? []) {
    backByEntry.set(bn.entry_id, bn.number);
  }

  return (
    <div>
      <PageHeader
        title="Entries"
        description="Office entries: rider + horse + classes, validated against eligibility as you go."
        action={
          canCreate && showEditable ? (
            <ButtonLink href={`/shows/${id}/entries/new`}>New entry</ButtonLink>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No entries yet"
          description="Create the first entry by picking a rider, a horse, and their classes."
          action={
            canCreate && showEditable ? (
              <ButtonLink href={`/shows/${id}/entries/new`}>
                New entry
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Entry</th>
                  <th className="py-2 pr-4 font-medium">Back #</th>
                  <th className="py-2 pr-4 font-medium">Rider / Horse</th>
                  <th className="py-2 pr-4 font-medium">Classes</th>
                  <th className="py-2 pr-4 font-medium">Class fees</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {rows.map((entry) => {
                  const stat = classStats.get(entry.id);
                  const backNumber = backByEntry.get(entry.id);
                  return (
                    <tr key={entry.id}>
                      <td className="py-3 pr-4 font-mono">
                        <Link
                          href={`/shows/${id}/entries/${entry.id}`}
                          className="font-medium text-brand-700 hover:underline dark:text-brand-500"
                        >
                          {entry.entry_number}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        {backNumber ? `#${backNumber}` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{entry.rider_name}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {entry.horse_name}
                          {entry.owner_name && ` · owner ${entry.owner_name}`}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        {stat?.entered ?? 0}
                        {stat && stat.scratched > 0 && (
                          <span className="text-xs text-stone-500 dark:text-stone-400">
                            {" "}
                            (+{stat.scratched} scratched)
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {formatCents(stat?.feeCents ?? 0)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                            entry.status === "active"
                              ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
