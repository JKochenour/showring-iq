import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { WeekendEntryManager } from "@/components/weekend/weekend-entry-manager";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Manage entries — ShowRing IQ" };

interface EntryClassRow {
  id: string;
  class_id: string;
  status: string;
}
interface EntryRow {
  id: string;
  show_id: string;
  horse_id: string;
  rider_person_id: string;
  rider_name: string | null;
  horse_name: string | null;
  entry_classes: EntryClassRow[] | null;
}

export default async function ManageWeekendEntriesPage({
  params,
}: {
  params: Promise<{ id: string; weekendId: string }>;
}) {
  const { id, weekendId } = await params;
  const { supabase } = await requireUser();

  const { data: weekend } = await supabase
    .from("show_weekends")
    .select("id, name, organization_id, shows:shows(id, name, status, start_date)")
    .eq("id", weekendId)
    .maybeSingle();
  if (!weekend || weekend.organization_id !== id) notFound();

  const canEdit = await hasOrgPermission(id, "entry.edit");

  const slateShows = (
    (weekend.shows as { id: string; name: string; status: string; start_date: string }[]) ?? []
  )
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const slateIds = slateShows.map((s) => s.id);

  const [{ data: classes }, { data: entries }, { data: backNumbers }] = await Promise.all([
    slateIds.length
      ? supabase
          .from("classes")
          .select("id, class_number, name, entry_fee_cents, show_id, concurrent_group_id")
          .in("show_id", slateIds)
          .not("status", "in", "(cancelled,archived)")
          .order("display_order")
      : Promise.resolve({ data: [] as never[] }),
    slateIds.length
      ? supabase
          .from("entries")
          .select(
            "id, show_id, horse_id, rider_person_id, rider_name, horse_name, entry_classes(id, class_id, status)"
          )
          .in("show_id", slateIds)
      : Promise.resolve({ data: [] as EntryRow[] }),
    supabase
      .from("weekend_back_numbers")
      .select("horse_id, number")
      .eq("weekend_id", weekendId),
  ]);

  const slates = slateShows.map((s) => ({
    showId: s.id,
    name: s.name,
    classes: (
      (classes as {
        id: string;
        class_number: number;
        name: string;
        entry_fee_cents: number;
        show_id: string;
        concurrent_group_id: string | null;
      }[]) ?? []
    )
      .filter((c) => c.show_id === s.id)
      .map((c) => ({
        id: c.id,
        classNumber: c.class_number,
        name: c.name,
        feeCents: c.entry_fee_cents,
        concurrentGroupId: c.concurrent_group_id,
      })),
  }));

  const backByHorse = new Map(
    (backNumbers ?? []).map((b) => [b.horse_id as string, b.number as number])
  );

  // Build the roster: one card per horse → its exhibitors → classes per slate.
  const horseMap = new Map<
    string,
    {
      horseId: string;
      horseName: string;
      backNumber: number | null;
      exhibitors: Map<
        string,
        {
          riderPersonId: string;
          riderName: string;
          entered: Record<string, { classId: string; entryClassId: string; status: string }[]>;
        }
      >;
    }
  >();

  for (const e of (entries as EntryRow[]) ?? []) {
    let horse = horseMap.get(e.horse_id);
    if (!horse) {
      horse = {
        horseId: e.horse_id,
        horseName: e.horse_name ?? "Unknown horse",
        backNumber: backByHorse.get(e.horse_id) ?? null,
        exhibitors: new Map(),
      };
      horseMap.set(e.horse_id, horse);
    }
    let ex = horse.exhibitors.get(e.rider_person_id);
    if (!ex) {
      ex = { riderPersonId: e.rider_person_id, riderName: e.rider_name ?? "Rider", entered: {} };
      horse.exhibitors.set(e.rider_person_id, ex);
    }
    ex.entered[e.show_id] = (e.entry_classes ?? []).map((ec) => ({
      classId: ec.class_id,
      entryClassId: ec.id,
      status: ec.status,
    }));
  }

  const horses = [...horseMap.values()]
    .map((h) => ({
      ...h,
      exhibitors: [...h.exhibitors.values()],
    }))
    .sort((a, b) => (a.backNumber ?? 99999) - (b.backNumber ?? 99999));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Manage entries — ${weekend.name}`}
        description="Find a horse by back number, name, or rider, then add or drop classes across both slates from one screen."
        action={
          <Link
            href={`/organizations/${id}/weekends/${weekendId}/entries/new`}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            + New horse / rider
          </Link>
        }
      />
      {!canEdit ? (
        <Alert tone="info">You don&apos;t have the entry.edit permission in this organization.</Alert>
      ) : (
        <WeekendEntryManager weekendId={weekendId} slates={slates} horses={horses} />
      )}
    </div>
  );
}
