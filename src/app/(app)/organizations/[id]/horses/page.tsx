import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
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
  ]);

  if (!org) notFound();

  const rows = (horses as Horse[]) ?? [];

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

  return (
    <div>
      <PageHeader
        title="Horses"
        description="The organization's horse database: registrations, competition licenses, and ownership."
        action={
          canCreate ? (
            <ButtonLink href={`/organizations/${id}/horses/new`}>
              Add horse
            </ButtonLink>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No horses yet"
          description="Add horses with their registration and competition license numbers."
          action={
            canCreate ? (
              <ButtonLink href={`/organizations/${id}/horses/new`}>
                Add horse
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Horse</th>
                  <th className="py-2 pr-4 font-medium">Details</th>
                  <th className="py-2 pr-4 font-medium">Registrations</th>
                  <th className="py-2 font-medium">Owners</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((horse) => (
                  <tr key={horse.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/organizations/${id}/horses/${horse.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-500"
                      >
                        {horse.registered_name}
                      </Link>
                      {horse.barn_name && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          “{horse.barn_name}”
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
                      {[
                        horse.breed,
                        horse.sex,
                        horse.color,
                        horse.foal_year ? `foaled ${horse.foal_year}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
                      {regsByHorse.get(horse.id)?.join(", ") ?? "—"}
                    </td>
                    <td className="py-3 text-zinc-500 dark:text-zinc-400">
                      {ownersByHorse.get(horse.id)?.join(", ") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
