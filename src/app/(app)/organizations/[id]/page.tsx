import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { Card } from "@/components/ui";

export const metadata = { title: "Organization — ShowRing IQ" };

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const [{ data: org }, { count: memberCount }, { data: myMembership }] =
    await Promise.all([
      supabase.from("organizations").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id)
        .eq("status", "active"),
      supabase
        .from("organization_members")
        .select("role:organization_roles(name)")
        .eq("organization_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (!org) notFound();

  const myRole =
    (myMembership?.role as unknown as { name: string } | null)?.name ?? "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Your role</p>
        <p className="mt-1 text-lg font-semibold">{myRole}</p>
      </Card>
      <Link href={`/organizations/${id}/members`}>
        <Card className="h-full transition-colors hover:border-emerald-600">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Members</p>
          <p className="mt-1 text-lg font-semibold">{memberCount ?? 0}</p>
        </Card>
      </Link>
      <Card className="border-dashed">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Shows</p>
        <p className="mt-1 text-lg font-semibold text-zinc-400">
          Coming in Sprint 2
        </p>
      </Card>
      <Card className="sm:col-span-2 lg:col-span-3">
        <h2 className="mb-2 text-base font-semibold">Details</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:justify-start">
            <dt className="text-zinc-500 dark:text-zinc-400">Slug</dt>
            <dd>/{org.slug}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:justify-start">
            <dt className="text-zinc-500 dark:text-zinc-400">Contact</dt>
            <dd>{org.contact_email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:justify-start">
            <dt className="text-zinc-500 dark:text-zinc-400">Website</dt>
            <dd>{org.website ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:justify-start">
            <dt className="text-zinc-500 dark:text-zinc-400">Location</dt>
            <dd>
              {org.city ? `${org.city}${org.state ? `, ${org.state}` : ""}` : "—"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
