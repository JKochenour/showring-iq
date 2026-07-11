import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { Card, EmptyState } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Exhibitor dashboard — ShowRing IQ" };

export default async function ExhibitorDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { supabase, user } = await requireUser();

  // RLS scopes these to the caller's own linked person/horses/entries —
  // no organization_id filter needed for the "own data" guarantee, but we
  // still filter by org since a user can be an exhibitor in more than one.
  const [{ data: horses }, { data: shows }, { data: entries }] = await Promise.all([
    supabase
      .from("horses")
      .select("id, registered_name, barn_name")
      .eq("organization_id", orgId)
      .order("registered_name"),
    supabase
      .from("shows")
      .select("id, name, slug, status, start_date, end_date")
      .eq("organization_id", orgId)
      .eq("status", "published")
      .order("start_date"),
    supabase
      .from("entries")
      .select("id, show_id, status, horse_name, entry_classes(fee_cents, status)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const horseRows = horses ?? [];
  const showRows = shows ?? [];
  const entryRows =
    (entries as unknown as {
      id: string;
      show_id: string;
      status: string;
      horse_name: string;
      entry_classes: { fee_cents: number; status: string }[];
    }[]) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-base font-semibold">Your horses</h2>
        {horseRows.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No horses linked to your profile yet — ask the show office to add you as an owner.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
            {horseRows.map((h) => (
              <li key={h.id} className="py-2">
                {h.registered_name}
                {h.barn_name && (
                  <span className="text-stone-500 dark:text-stone-400"> “{h.barn_name}”</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">Shows open for entry</h2>
        {showRows.length === 0 ? (
          <EmptyState title="No shows open right now" description="Check back closer to the next show date." />
        ) : (
          <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
            {showRows.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {s.start_date}
                    {s.end_date && s.end_date !== s.start_date ? ` – ${s.end_date}` : ""}
                  </p>
                </div>
                <Link
                  href={`/exhibitor/${orgId}/shows/${s.id}/enter`}
                  className="text-brand-700 hover:underline dark:text-brand-500"
                >
                  Enter →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">Recent entries</h2>
        {entryRows.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
            {entryRows.map((e) => {
              const total = e.entry_classes
                .filter((ec) => ec.status === "entered")
                .reduce((sum, ec) => sum + ec.fee_cents, 0);
              return (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span>
                    {e.horse_name} {e.status === "scratched" && "(scratched)"}
                  </span>
                  <span className="text-stone-500 dark:text-stone-400">{formatCents(total)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href={`/exhibitor/${orgId}/entries`}
          className="mt-3 inline-block text-sm text-brand-700 hover:underline dark:text-brand-500"
        >
          View all entries →
        </Link>
      </Card>
      <p className="text-xs text-stone-400 dark:text-stone-600">Signed in as {user.email}</p>
    </div>
  );
}
