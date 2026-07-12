import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { ReservationTypesEditor } from "@/components/show/reservation-types-editor";
import { ReservationManager } from "@/components/show/reservation-manager";
import { Alert, Card, PageHeader } from "@/components/ui";
import type { Reservation, Show } from "@/lib/types";

export const metadata = { title: "Reservations — ShowRing IQ" };

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, reservation_types")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id" | "reservation_types">;

  const canView = await hasOrgPermission(s.organization_id, "show.view");
  if (!canView) {
    return <Alert>You don&apos;t have permission to view this show.</Alert>;
  }

  const [canEditTypes, canManage, { data: entries }, { data: reservations }] =
    await Promise.all([
      hasOrgPermission(s.organization_id, "show.edit"),
      hasOrgPermission(s.organization_id, "invoice.edit"),
      supabase
        .from("entries")
        .select("rider_person_id, rider_name, owner_person_id, owner_name")
        .eq("show_id", id)
        .eq("status", "active"),
      supabase
        .from("reservations")
        .select("*")
        .eq("show_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const peopleMap = new Map<string, string>();
  for (const e of entries ?? []) {
    peopleMap.set(e.rider_person_id as string, e.rider_name as string);
    if (e.owner_person_id) {
      peopleMap.set(e.owner_person_id as string, (e.owner_name as string) ?? "Owner");
    }
  }
  const people = [...peopleMap.entries()]
    .map(([pid, label]) => ({ id: pid, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const typeRows = (s.reservation_types ?? []).map((t) => ({
    key: t.key,
    label: t.label,
    unitPrice: (t.unitPriceCents / 100).toFixed(2),
    slotOptionsText: t.slotOptions.join(", "),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Stalls, campers, warm-up slots — anything a show offers as an add-on. Confirming a reservation charges it to the person's bill automatically."
      />

      <Card>
        <h3 className="mb-3 text-base font-semibold">Reservation types</h3>
        <ReservationTypesEditor showId={id} types={typeRows} canEdit={canEditTypes} />
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">
          Requests ({(reservations ?? []).length})
        </h3>
        <ReservationManager
          showId={id}
          types={s.reservation_types ?? []}
          people={people}
          reservations={(reservations as Reservation[]) ?? []}
          canEdit={canManage}
        />
      </Card>
    </div>
  );
}
