import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  loadPublicShowsDirectory,
  type PublicDirectoryShow,
} from "@/lib/public-results";

export const metadata = { title: "Find shows — ShowRing IQ" };

function dateRange(show: Pick<PublicDirectoryShow, "start_date" | "end_date">) {
  return show.start_date === show.end_date
    ? show.start_date
    : `${show.start_date} – ${show.end_date}`;
}

function location(show: Pick<PublicDirectoryShow, "venue_name" | "city" | "state">) {
  return [show.venue_name, show.city, show.state].filter(Boolean).join(", ");
}

export default async function FindShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const shows = await loadPublicShowsDirectory(supabase);

  const query = (q ?? "").trim().toLowerCase();
  const filtered = query
    ? shows.filter((s) =>
        [s.name, s.organization_name, s.venue_name, s.city, s.state]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(query))
      )
    : shows;

  // "Upcoming" includes anything still running today.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = filtered
    .filter((s) => s.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = filtered.filter((s) => s.end_date < today);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find shows"
        description="Published shows across every organization on ShowRing IQ — open one for its schedule, draws, live scores, and results."
      />

      <form method="get" className="flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by show, organization, venue, or state…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-stone-700 dark:bg-stone-900"
        />
        <button
          type="submit"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Search
        </button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? "No shows match" : "No shows published yet"}
          description={
            query
              ? "Try a different show name, organization, venue, or state."
              : "Check back once organizations publish their shows."
          }
        />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-base font-semibold">
              Happening now &amp; upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Nothing upcoming{query ? " matches" : ""} right now.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((s) => (
                  <DirectoryCard key={`${s.organization_slug}/${s.slug}`} show={s} today={today} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold">Past shows</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((s) => (
                  <DirectoryCard key={`${s.organization_slug}/${s.slug}`} show={s} today={today} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DirectoryCard({
  show,
  today,
}: {
  show: PublicDirectoryShow;
  today: string;
}) {
  const live = show.start_date <= today && show.end_date >= today;
  return (
    <Card className="h-full transition-colors hover:border-brand-600">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">
          <Link
            href={`/${show.organization_slug}/${show.slug}`}
            className="hover:underline"
          >
            {show.name}
          </Link>
        </h3>
        {live && (
          <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300">
            Live
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
        <Link href={`/${show.organization_slug}`} className="hover:underline">
          {show.organization_name}
        </Link>
      </p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {[dateRange(show), location(show)].filter(Boolean).join(" · ")}
      </p>
    </Card>
  );
}
