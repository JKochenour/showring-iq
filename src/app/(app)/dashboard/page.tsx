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
        description="Your organizations, shows, staff, and everything that runs them."
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
          <div className="space-y-4">
            <EmptyState
              title="No organizations yet"
              description="Run shows? Create your organization (e.g. EPRHA) to start setting up shows, staff, and roles."
              action={
                <ButtonLink href="/organizations/new">
                  Create organization
                </ButtonLink>
              }
            />
            <Card>
              <h3 className="font-semibold">Here to show, not to run shows?</h3>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                Browse{" "}
                <Link
                  href="/shows"
                  className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  every published show
                </Link>{" "}
                — schedules, draws, live scores, and results are open to
                everyone, no account needed. To enter shows online, ask the
                show office to send you an exhibitor invite; it will appear
                here once they do.
              </p>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orgs.map(({ org, role, membershipId }) => (
              <Link key={membershipId} href={`/organizations/${org.id}`}>
                <Card className="h-full transition-colors hover:border-brand-600">
                  <h3 className="font-semibold">{org.name}</h3>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
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
