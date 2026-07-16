import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  loadPublicOrg,
  loadPublicOrgShows,
  type PublicOrgShow,
} from "@/lib/public-results";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const supabase = await createClient();
  const orgRow = await loadPublicOrg(supabase, org);
  if (!orgRow) return { title: "Organization not found — ShowRing IQ" };
  return { title: `${orgRow.name} — ShowRing IQ` };
}

function dateRange(show: Pick<PublicOrgShow, "start_date" | "end_date">) {
  return show.start_date === show.end_date
    ? show.start_date
    : `${show.start_date} – ${show.end_date}`;
}

export default async function PublicOrgPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const supabase = await createClient();

  const [orgRow, shows] = await Promise.all([
    loadPublicOrg(supabase, org),
    loadPublicOrgShows(supabase, org),
  ]);
  if (!orgRow) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = shows
    .filter((s) => s.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = shows.filter((s) => s.end_date < today);

  const orgLocation = [orgRow.city, orgRow.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title={orgRow.name}
          description={orgLocation || undefined}
        />
        {orgRow.website && (
          <p className="-mt-4 mb-6 text-sm">
            <a
              href={orgRow.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 hover:underline dark:text-brand-400"
            >
              {orgRow.website}
            </a>
          </p>
        )}
      </div>

      {shows.length === 0 ? (
        <EmptyState
          title="No shows published yet"
          description="Check back once this organization publishes a show."
        />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-base font-semibold">
              Happening now &amp; upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Nothing upcoming right now.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((s) => (
                  <OrgShowCard key={s.slug} orgSlug={org} show={s} today={today} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold">Past shows</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((s) => (
                  <OrgShowCard key={s.slug} orgSlug={org} show={s} today={today} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-sm text-stone-500 dark:text-stone-400">
        <Link href="/shows" className="hover:underline">
          ← Find shows from every organization
        </Link>
      </p>
    </div>
  );
}

function OrgShowCard({
  orgSlug,
  show,
  today,
}: {
  orgSlug: string;
  show: PublicOrgShow;
  today: string;
}) {
  const live = show.start_date <= today && show.end_date >= today;
  const location = [show.venue_name, show.city, show.state]
    .filter(Boolean)
    .join(", ");
  return (
    <Card className="h-full transition-colors hover:border-brand-600">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">
          <Link href={`/${orgSlug}/${show.slug}`} className="hover:underline">
            {show.name}
          </Link>
        </h3>
        {live && (
          <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300">
            Live
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {[dateRange(show), location].filter(Boolean).join(" · ")}
      </p>
    </Card>
  );
}
