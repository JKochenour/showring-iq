import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { PendingInvites } from "@/components/org/pending-invites";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { PendingInvite } from "@/lib/types";

export const metadata = { title: "Dashboard — ShowRing IQ" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: memberships }, { data: invites }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase
        .from("organization_members")
        .select(
          "id, role:organization_roles(name), organization:organizations(id, name, slug)"
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
      },
    })) ?? [];

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        description="Sprint 1 foundation: organizations, members, roles, and permissions. Shows arrive in Sprint 2."
      />

      <PendingInvites invites={(invites as PendingInvite[]) ?? []} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Your organizations</h2>
          {orgs.length > 0 && (
            <ButtonLink href="/organizations/new" variant="secondary">
              New organization
            </ButtonLink>
          )}
        </div>
        {orgs.length === 0 ? (
          <EmptyState
            title="No organizations yet"
            description="Create your organization (e.g. EPRHA) to start setting up shows, staff, and roles."
            action={
              <ButtonLink href="/organizations/new">
                Create organization
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orgs.map(({ org, role, membershipId }) => (
              <Link key={membershipId} href={`/organizations/${org.id}`}>
                <Card className="h-full transition-colors hover:border-emerald-600">
                  <h3 className="font-semibold">{org.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    /{org.slug} · Your role: {role}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
