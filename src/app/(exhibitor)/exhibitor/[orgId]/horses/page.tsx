import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Horse } from "@/lib/types";

export const metadata = { title: "My horses — ShowRing IQ" };

export default async function ExhibitorHorsesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { supabase } = await requireUser();

  const [{ data: org }, { data: horses }] = await Promise.all([
    supabase.from("organizations").select("id").eq("id", orgId).maybeSingle(),
    supabase
      .from("horses")
      .select("*")
      .eq("organization_id", orgId)
      .order("registered_name"),
  ]);

  if (!org) notFound();

  const horseRows = (horses as Horse[]) ?? [];

  return (
    <div>
      <PageHeader
        title="My horses"
        description="Horses you own or co-own in this organization."
        action={
          <ButtonLink href={`/exhibitor/${orgId}/horses/new`}>Add horse</ButtonLink>
        }
      />

      {horseRows.length === 0 ? (
        <EmptyState
          title="No horses yet"
          description="Add a horse to enter it in a show."
          action={<ButtonLink href={`/exhibitor/${orgId}/horses/new`}>Add horse</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {horseRows.map((h) => (
            <li key={h.id}>
              <Link href={`/exhibitor/${orgId}/horses/${h.id}`}>
                <Card className="h-full transition hover:border-emerald-300 dark:hover:border-emerald-800">
                  <p className="font-medium">{h.registered_name}</p>
                  {h.barn_name && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      “{h.barn_name}”
                    </p>
                  )}
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {[h.breed, h.sex, h.color, h.foal_year ? `foaled ${h.foal_year}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
