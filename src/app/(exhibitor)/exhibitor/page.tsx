import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Exhibitor — ShowRing IQ" };

export default async function ExhibitorPickOrgPage() {
  const { supabase, user } = await requireUser();

  const { data: people } = await supabase
    .from("people")
    .select("organization_id, first_name, last_name, organization:organizations(name)")
    .eq("user_id", user.id);

  const rows =
    (people as unknown as {
      organization_id: string;
      first_name: string;
      last_name: string;
      organization: { name: string } | null;
    }[]) ?? [];

  if (rows.length === 1) {
    redirect(`/exhibitor/${rows[0].organization_id}/dashboard`);
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Your exhibitor accounts</h1>
        <SignOutButton />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No exhibitor access yet"
          description="Ask the show office to send you an exhibitor invite for their organization. Until then, every published show's schedule, draws, live scores, and results are open to everyone."
          action={
            <Link
              href="/shows"
              className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Find shows →
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.organization_id}>
              <Link
                href={`/exhibitor/${r.organization_id}/dashboard`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{r.organization?.name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {r.first_name} {r.last_name}
                  </p>
                </div>
                <span className="text-brand-700 dark:text-brand-500">Open →</span>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
