import { requireUser } from "@/lib/authz";
import { ExhibitorScratchButton } from "@/components/exhibitor/scratch-button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const metadata = { title: "My entries — ShowRing IQ" };

export default async function ExhibitorEntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { orgId } = await params;
  const { submitted } = await searchParams;
  const { supabase } = await requireUser();

  const { data: entries } = await supabase
    .from("entries")
    .select(
      "id, status, horse_name, notes, show:shows(id, name, start_date, status), entry_classes(id, status, fee_cents, class:classes(class_number, name))"
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    status: string;
    horse_name: string;
    notes: string | null;
    show: { id: string; name: string; start_date: string; status: string } | null;
    entry_classes: {
      id: string;
      status: string;
      fee_cents: number;
      class: { class_number: number; name: string } | null;
    }[];
  };
  const rows = (entries as unknown as Row[]) ?? [];

  return (
    <div>
      <PageHeader title="My entries" />
      {submitted && (
        <div className="mb-4">
          <Alert tone="success">
            Entry submitted. Fees are due at the show unless your office arranges otherwise.
          </Alert>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No entries yet" description="Enter a published show to get started." />
      ) : (
        <div className="space-y-4">
          {rows.map((entry) => {
            const total = entry.entry_classes
              .filter((ec) => ec.status === "entered")
              .reduce((sum, ec) => sum + ec.fee_cents, 0);
            const showEditable = entry.show?.status === "published";
            return (
              <Card key={entry.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {entry.show?.name} — {entry.horse_name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {entry.show?.start_date}
                      {entry.status === "scratched" && " · Entry scratched"}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{formatCents(total)}</p>
                </div>
                <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                  {entry.entry_classes.map((ec) => (
                    <li key={ec.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="font-mono text-xs text-zinc-500">
                          {ec.class?.class_number}
                        </span>{" "}
                        {ec.class?.name}
                        {ec.status === "scratched" && (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                            Scratched
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {formatCents(ec.fee_cents)}
                        </span>
                        {ec.status === "entered" && showEditable && entry.status === "active" && (
                          <ExhibitorScratchButton
                            entryClassId={ec.id}
                            organizationId={orgId}
                            label={`Class ${ec.class?.class_number} — ${ec.class?.name}`}
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {!showEditable && entry.status === "active" && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    This show is no longer open for self-service changes — contact the show office
                    for scratches.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
