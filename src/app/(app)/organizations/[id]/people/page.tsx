import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { PERSON_ROLES } from "@/lib/validation/person";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { JoinRequestsCard } from "@/components/org/join-requests";
import { PeopleTable, type PersonRow } from "@/components/org/people-table";
import type { ExhibitorJoinRequest, Person, PersonMembership } from "@/lib/types";

export const metadata = { title: "People — ShowRing IQ" };

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [
    { data: org },
    { data: people },
    { data: memberships },
    { data: joinRequests },
    canCreate,
    canDelete,
    canInvite,
  ] = await Promise.all([
    supabase.from("organizations").select("id").eq("id", id).maybeSingle(),
    supabase
      .from("people")
      .select("*")
      .eq("organization_id", id)
      .order("last_name")
      .order("first_name"),
    supabase
      .from("person_memberships")
      .select("person_id, association, membership_number")
      .eq("organization_id", id),
    supabase
      .from("exhibitor_join_requests")
      .select("*")
      .eq("organization_id", id)
      .eq("status", "pending")
      .order("created_at"),
    hasOrgPermission(id, "person.create"),
    hasOrgPermission(id, "person.edit"),
    hasOrgPermission(id, "org.members.invite"),
  ]);

  if (!org) notFound();

  const peopleRows = (people as Person[]) ?? [];
  const membershipsByPerson = new Map<string, string[]>();
  for (const m of (memberships as Pick<
    PersonMembership,
    "person_id" | "association" | "membership_number"
  >[]) ?? []) {
    const list = membershipsByPerson.get(m.person_id) ?? [];
    list.push(`${m.association} ${m.membership_number}`);
    membershipsByPerson.set(m.person_id, list);
  }

  const roleLabel = (v: string) =>
    PERSON_ROLES.find((r) => r.value === v)?.label ?? v;

  const rows: PersonRow[] = peopleRows.map((person) => ({
    id: person.id,
    displayName: `${person.last_name}, ${person.first_name}`,
    location: person.city ? `${person.city}${person.state ? `, ${person.state}` : ""}` : null,
    roleLabels: person.roles.map(roleLabel),
    memberships: membershipsByPerson.get(person.id)?.join(", ") ?? "—",
    contact: person.email ?? person.phone ?? "—",
  }));

  const unlinkedPeople = peopleRows
    .filter((p) => !p.user_id)
    .map((p) => ({ id: p.id, label: `${p.last_name}, ${p.first_name}` }));

  return (
    <div>
      <PageHeader
        title="People"
        description="Riders, owners, trainers, and judges. Saved once at the organization level and reused across every show."
        action={
          canCreate ? (
            <div className="flex gap-2">
              <ButtonLink href={`/organizations/${id}/people/import`} variant="secondary">
                Import from spreadsheet
              </ButtonLink>
              <ButtonLink href={`/organizations/${id}/people/new`}>
                Add person
              </ButtonLink>
            </div>
          ) : undefined
        }
      />

      {canInvite && (
        <JoinRequestsCard
          organizationId={id}
          requests={(joinRequests as ExhibitorJoinRequest[]) ?? []}
          unlinkedPeople={unlinkedPeople}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No people yet"
          description="Add riders, owners, and trainers with their association membership numbers, or import your whole roster from a spreadsheet."
          action={
            canCreate ? (
              <div className="flex gap-2">
                <ButtonLink href={`/organizations/${id}/people/import`} variant="secondary">
                  Import from spreadsheet
                </ButtonLink>
                <ButtonLink href={`/organizations/${id}/people/new`}>
                  Add person
                </ButtonLink>
              </div>
            ) : undefined
          }
        />
      ) : (
        <PeopleTable organizationId={id} rows={rows} canDelete={canDelete} />
      )}
    </div>
  );
}
