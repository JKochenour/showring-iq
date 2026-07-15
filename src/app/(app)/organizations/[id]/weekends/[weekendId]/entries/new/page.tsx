import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { WeekendEntryGrid } from "@/components/weekend/weekend-entry-grid";
import { Alert, PageHeader } from "@/components/ui";
import type { Person } from "@/lib/types";

export const metadata = { title: "New weekend entry — ShowRing IQ" };

export default async function NewWeekendEntryPage({
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

  const canCreate = await hasOrgPermission(id, "entry.create");

  const slateShows = (
    (weekend.shows as {
      id: string;
      name: string;
      status: string;
      start_date: string;
    }[]) ?? []
  )
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const slateIds = slateShows.map((s) => s.id);

  const [{ data: classes }, { data: people }, { data: horses }] = await Promise.all([
    slateIds.length > 0
      ? supabase
          .from("classes")
          .select("id, class_number, name, entry_fee_cents, status, show_id, display_order")
          .in("show_id", slateIds)
          .not("status", "in", "(cancelled,archived)")
          .order("display_order")
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("people")
      .select("id, first_name, last_name, roles")
      .eq("organization_id", id)
      .order("last_name"),
    supabase
      .from("horses")
      .select("id, registered_name, barn_name")
      .eq("organization_id", id)
      .order("registered_name"),
  ]);

  const peopleRows =
    (people as Pick<Person, "id" | "first_name" | "last_name" | "roles">[]) ?? [];
  const byRole = (role: string) =>
    peopleRows
      .filter((p) => p.roles.includes(role))
      .map((p) => ({ id: p.id, label: `${p.last_name}, ${p.first_name}` }));

  const horseOptions =
    horses?.map((h) => ({
      id: h.id as string,
      label: h.barn_name
        ? `${h.registered_name} (“${h.barn_name}”)`
        : (h.registered_name as string),
    })) ?? [];

  const classRows = ((classes as {
    id: string;
    class_number: number;
    name: string;
    entry_fee_cents: number;
    show_id: string;
  }[]) ?? []).map((c) => ({
    id: c.id,
    classNumber: c.class_number,
    name: c.name,
    feeCents: c.entry_fee_cents,
    showId: c.show_id,
  }));

  const slates = slateShows.map((s) => ({
    showId: s.id,
    name: s.name,
    classes: classRows.filter((c) => c.showId === s.id),
  }));

  const showEditable = slateShows.some(
    (s) => s.status === "draft" || s.status === "published"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`New entry — ${weekend.name}`}
        description="Pick the horse and rider, who's billed, and check which classes they run in each slate. The horse keeps one back number all weekend; office/stall/drug is charged once, class/video/photo per run."
      />
      {!canCreate || !showEditable ? (
        <Alert tone="info">
          {!showEditable
            ? "The slates are locked; entries can't be added."
            : "You don't have the entry.create permission in this organization."}
        </Alert>
      ) : (
        <WeekendEntryGrid
          weekendId={weekendId}
          organizationId={id}
          riders={byRole("rider")}
          owners={byRole("owner")}
          horses={horseOptions}
          slates={slates}
        />
      )}
    </div>
  );
}
