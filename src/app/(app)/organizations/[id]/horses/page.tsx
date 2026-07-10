import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { HorsesTable, type HorseRow } from "@/components/org/horses-table";
import type { Horse, HorseOwnership, HorseRegistration } from "@/lib/types";

export const metadata = { title: "Horses — ShowRing IQ" };

export default async function HorsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [
    { data: org },
    { data: horses },
    { data: registrations },
    { data: ownerships },
    canCreate,
    canDelete,
  ] = await Promise.all([
    supabase.from("organizations").select("id").eq("id", id).maybeSingle(),
    supabase
      .from("horses")
      .select("*")
      .eq("organization_id", id)
      .order("registered_name"),
    supabase
      .from("horse_registrations")
      .select("horse_id, association, registration_number, competition_license_number")
      .eq("organization_id", id),
    supabase
      .from("horse_ownerships")
      .select("horse_id, percentage, owner:people(id, first_name, last_name)")
      .eq("organization_id", id),
    hasOrgPermission(id, "horse.create"),
    hasOrgPermission(id, "horse.edit"),
  ]);

  if (!org) notFound();

  const horseRows = (horses as Horse[]) ?? [];

  const regsByHorse = new Map<string, string[]>();
  for (const r of (registrations as Pick<
    HorseRegistration,
    "horse_id" | "association" | "registration_number" | "competition_license_number"
  >[]) ?? []) {
    const list = regsByHorse.get(r.horse_id) ?? [];
    list.push(
      `${r.association} ${r.registration_number ?? r.competition_license_number ?? ""}`.trim()
    );
    regsByHorse.set(r.horse_id, list);
  }

  const ownersByHorse = new Map<string, string[]>();
  for (const o of (ownerships as unknown as Pick<
    HorseOwnership,
    "horse_id" | "percentage" | "owner"
  >[]) ?? []) {
    if (!o.owner) continue;
    const list = ownersByHorse.get(o.horse_id) ?? [];
    list.push(
      `${o.owner.first_name} ${o.owner.last_name}${o.percentage < 100 ? ` (${o.percentage}%)` : ""}`
    );
    ownersByHorse.set(o.horse_id, list);
  }

  const rows: HorseRow[] = horseRows.map((horse) => ({
    id: horse.id,
    registeredName: horse.registered_name,
    barnName: horse.barn_name,
    details:
      [horse.breed, horse.sex, horse.color, horse.foal_year ? `foaled ${horse.foal_year}` : null]
        .filter(Boolean)
        .join(" · ") || "—",
    registrations: regsByHorse.get(horse.id)?.join(", ") ?? "—",
    owners: ownersByHorse.get(horse.id)?.join(", ") ?? "—",
  }));

  return (
    <div>
      <PageHeader
        title="Horses"
        description="The organization's horse database: registrations, competition licenses, and ownership."
        action={
          canCreate ? (
            <div className="flex gap-2">
              <ButtonLink href={`/organizations/${id}/horses/import`} variant="secondary">
                Import from spreadsheet
              </ButtonLink>
              <ButtonLink href={`/organizations/${id}/horses/new`}>
                Add horse
              </ButtonLink>
            </div>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No horses yet"
          description="Add horses with their registration and competition license numbers, or import your whole database from a spreadsheet."
          action={
            canCreate ? (
              <div className="flex gap-2">
                <ButtonLink href={`/organizations/${id}/horses/import`} variant="secondary">
                  Import from spreadsheet
                </ButtonLink>
                <ButtonLink href={`/organizations/${id}/horses/new`}>
                  Add horse
                </ButtonLink>
              </div>
            ) : undefined
          }
        />
      ) : (
        <HorsesTable organizationId={id} rows={rows} canDelete={canDelete} />
      )}
    </div>
  );
}
