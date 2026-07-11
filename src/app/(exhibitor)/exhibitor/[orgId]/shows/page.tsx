import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Enter a show — ShowRing IQ" };

export default async function ExhibitorShowsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { supabase } = await requireUser();

  const { data: shows } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date, venue_name, city, state")
    .eq("organization_id", orgId)
    .eq("status", "published")
    .order("start_date");

  const rows = shows ?? [];

  return (
    <div>
      <PageHeader title="Enter a show" description="Published shows currently open for entry." />
      {rows.length === 0 ? (
        <EmptyState title="No shows open right now" />
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {s.start_date}
                    {s.end_date && s.end_date !== s.start_date ? ` – ${s.end_date}` : ""}
                    {s.venue_name ? ` · ${s.venue_name}` : ""}
                    {s.city ? ` · ${s.city}${s.state ? `, ${s.state}` : ""}` : ""}
                  </p>
                </div>
                <Link
                  href={`/exhibitor/${orgId}/shows/${s.id}/enter`}
                  className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                  Enter this show
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
