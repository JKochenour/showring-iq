import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { PERSON_ROLES } from "@/lib/validation/person";
import { Card } from "@/components/ui";
import { ProfileForm } from "@/components/exhibitor/profile-form";
import type { Person, PersonMembership } from "@/lib/types";

export const metadata = { title: "My profile — ShowRing IQ" };

export default async function ExhibitorProfilePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { supabase, user } = await requireUser();

  const { data: person } = await supabase
    .from("people")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!person) notFound();
  const p = person as Person;

  const { data: memberships } = await supabase
    .from("person_memberships")
    .select("*")
    .eq("person_id", p.id)
    .order("association");
  const membershipRows = (memberships as PersonMembership[]) ?? [];

  const roleLabel = (v: string) => PERSON_ROLES.find((r) => r.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {p.first_name} {p.last_name}
          {p.preferred_name && (
            <span className="ml-2 text-base font-normal text-zinc-500 dark:text-zinc-400">
              “{p.preferred_name}”
            </span>
          )}
        </h2>
        {p.roles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.roles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {roleLabel(role)}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Name and roles are managed by the show office — contact them to make
          changes.
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-base font-semibold">Contact details</h3>
        <ProfileForm person={p} />
      </section>

      <Card>
        <h3 className="mb-1 text-base font-semibold">Association memberships</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Contact the show office to add or update membership numbers.
        </p>
        {membershipRows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No memberships recorded.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {membershipRows.map((m) => (
              <li key={m.id} className="py-3">
                <p className="text-sm font-medium">
                  {m.association} #{m.membership_number}
                  {m.membership_type && ` · ${m.membership_type}`}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {m.status}
                  {m.expiration_date && ` · expires ${m.expiration_date}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
