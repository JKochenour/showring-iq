import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { GroupShowsForm } from "@/components/weekend/group-shows-form";
import { Alert, PageHeader } from "@/components/ui";
import type { ShowStatus } from "@/lib/types";

export const metadata = { title: "New weekend — ShowRing IQ" };

export default async function NewWeekendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: org }, { data: shows }, { data: entryShowIds }, canCreate] =
    await Promise.all([
      supabase.from("organizations").select("id, name").eq("id", id).maybeSingle(),
      supabase
        .from("shows")
        .select("id, name, status, start_date, weekend_id")
        .eq("organization_id", id)
        .order("start_date", { ascending: false }),
      supabase.from("entries").select("show_id").eq("organization_id", id),
      hasOrgPermission(id, "show.create"),
    ]);

  if (!org) notFound();

  const withEntries = new Set((entryShowIds ?? []).map((e) => e.show_id as string));

  // Count slates per weekend so we can flag shows already in a multi-slate one.
  const weekendCounts = new Map<string, number>();
  for (const s of (shows ?? []) as { weekend_id: string | null }[]) {
    if (s.weekend_id) {
      weekendCounts.set(s.weekend_id, (weekendCounts.get(s.weekend_id) ?? 0) + 1);
    }
  }

  const showOptions = ((shows ?? []) as {
    id: string;
    name: string;
    status: ShowStatus;
    start_date: string;
    weekend_id: string | null;
  }[]).map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    startDate: s.start_date,
    hasEntries: withEntries.has(s.id),
    inMultiSlateWeekend: (weekendCounts.get(s.weekend_id ?? "") ?? 0) >= 2,
  }));

  return (
    <div>
      <PageHeader
        title="New weekend"
        description="Pick the shows that are the slates of this weekend. Group them before taking entries — a horse's shared back number and once-per-weekend fees are set up as entries come in."
      />
      {!canCreate ? (
        <Alert tone="info">
          You don&apos;t have the show.create permission in this organization.
        </Alert>
      ) : (
        <GroupShowsForm organizationId={id} shows={showOptions} />
      )}
    </div>
  );
}
