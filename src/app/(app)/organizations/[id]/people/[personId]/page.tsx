import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import {
  deletePerson,
  removeMembership,
} from "@/app/(app)/organizations/[id]/people/actions";
import { EditPersonForm } from "@/components/org/person-form";
import { AddMembershipForm } from "@/components/org/membership-manager";
import { RemoveButton } from "@/components/remove-button";
import { Card } from "@/components/ui";
import type { Person, PersonMembership } from "@/lib/types";

export const metadata = { title: "Person — ShowRing IQ" };

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id, personId } = await params;
  const { supabase } = await requireUser();

  const [{ data: person }, { data: memberships }, canEdit, canEditMemberships] =
    await Promise.all([
      supabase
        .from("people")
        .select("*")
        .eq("id", personId)
        .eq("organization_id", id)
        .maybeSingle(),
      supabase
        .from("person_memberships")
        .select("*")
        .eq("person_id", personId)
        .order("association"),
      hasOrgPermission(id, "person.edit"),
      hasOrgPermission(id, "membership.edit"),
    ]);

  if (!person) notFound();
  const p = person as Person;
  const membershipRows = (memberships as PersonMembership[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/organizations/${id}/people`} className="hover:underline">
            People
          </Link>{" "}
          / {p.first_name} {p.last_name}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {p.first_name} {p.last_name}
          {p.preferred_name && (
            <span className="ml-2 text-base font-normal text-zinc-500 dark:text-zinc-400">
              “{p.preferred_name}”
            </span>
          )}
        </h2>
      </div>

      <Card>
        <h3 className="mb-1 text-base font-semibold">Association memberships</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Membership numbers are required for association exports (e.g. the
          rider&apos;s NRHA number on the ReinerSuite CSV).
        </p>
        {membershipRows.length > 0 && (
          <ul className="mb-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {membershipRows.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {m.association} #{m.membership_number}
                    {m.membership_type && ` · ${m.membership_type}`}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {m.status}
                    {m.expiration_date && ` · expires ${m.expiration_date}`}
                    {m.verified_at
                      ? ` · verified ${new Date(m.verified_at).toLocaleDateString()}`
                      : " · not verified"}
                  </p>
                </div>
                {canEditMemberships && (
                  <RemoveButton
                    action={removeMembership.bind(null, m.id)}
                    confirmText={`Remove ${m.association} #${m.membership_number}?`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditMemberships ? (
          <AddMembershipForm personId={personId} />
        ) : (
          membershipRows.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No memberships recorded.
            </p>
          )
        )}
      </Card>

      {canEdit && (
        <>
          <section>
            <h3 className="mb-3 text-base font-semibold">Profile</h3>
            <EditPersonForm person={p} />
          </section>
          <Card className="max-w-2xl border-red-200 dark:border-red-900">
            <h3 className="mb-1 text-sm font-semibold">Danger zone</h3>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Deleting removes this person and their memberships. Once entries
              exist (Sprint 5), people connected to entries can&apos;t be
              deleted.
            </p>
            <RemoveButton
              action={deletePerson.bind(null, personId)}
              label="Delete person"
              pendingLabel="Deleting…"
              confirmText={`Permanently delete ${p.first_name} ${p.last_name}? This cannot be undone.`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
