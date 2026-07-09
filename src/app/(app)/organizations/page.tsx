import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { PendingInvites } from "@/components/org/pending-invites";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { PendingInvite } from "@/lib/types";

export const metadata = { title: "Organizations — ShowRing IQ" };

export default async function OrganizationsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: memberships }, { data: invites }] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "id, created_at, role:organization_roles(name), organization:organizations(id, name, slug, city, state)"
      )
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase.rpc("my_pending_invites"),
  ]);

  const orgs =
    memberships?.map((m) => ({
      membershipId: m.id,
      role: (m.role as unknown as { name: string } | null)?.name ?? "Member",
      org: m.organization as unknown as {
        id: string;
        name: string;
        slug: string;
        city: string | null;
        state: string | null;
      },
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Show-producing organizations you belong to."
        action={<ButtonLink href="/organizations/new">New organization</ButtonLink>}
      />

      <PendingInvites invites={(invites as PendingInvite[]) ?? []} />

      {orgs.length === 0 ? (
        <EmptyState
          title="You don't belong to any organizations yet"
          description="Create one, or ask an organization owner to invite the email you signed up with."
          action={
            <ButtonLink href="/organizations/new">Create organization</ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map(({ org, role, membershipId }) => (
            <Link key={membershipId} href={`/organizations/${org.id}`}>
              <Card className="h-full transition-colors hover:border-emerald-600">
                <h3 className="font-semibold">{org.name}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  /{org.slug}
                  {org.city && ` · ${org.city}${org.state ? `, ${org.state}` : ""}`}
                </p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Your role: {role}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
