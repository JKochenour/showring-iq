import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { PERSON_ROLES } from "@/lib/validation/person";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Person, PersonMembership } from "@/lib/types";

export const metadata = { title: "People — ShowRing IQ" };

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: org }, { data: people }, { data: memberships }, canCreate] =
    await Promise.all([
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
      hasOrgPermission(id, "person.create"),
    ]);

  if (!org) notFound();

  const rows = (people as Person[]) ?? [];
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

  return (
    <div>
      <PageHeader
        title="People"
        description="Riders, owners, trainers, and judges. Saved once at the organization level and reused across every show."
        action={
          canCreate ? (
            <ButtonLink href={`/organizations/${id}/people/new`}>
              Add person
            </ButtonLink>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No people yet"
          description="Add riders, owners, and trainers with their association membership numbers."
          action={
            canCreate ? (
              <ButtonLink href={`/organizations/${id}/people/new`}>
                Add person
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
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Roles</th>
                  <th className="py-2 pr-4 font-medium">Memberships</th>
                  <th className="py-2 font-medium">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((person) => (
                  <tr key={person.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/organizations/${id}/people/${person.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-500"
                      >
                        {person.last_name}, {person.first_name}
                      </Link>
                      {person.city && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {person.city}
                          {person.state ? `, ${person.state}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {person.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {roleLabel(role)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
                      {membershipsByPerson.get(person.id)?.join(", ") ?? "—"}
                    </td>
                    <td className="py-3 text-zinc-500 dark:text-zinc-400">
                      {person.email ?? person.phone ?? "—"}
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
