import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { CreateOwnHorseForm } from "@/components/exhibitor/horse-form";

export const metadata = { title: "Add horse — ShowRing IQ" };

export default async function NewExhibitorHorsePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { supabase } = await requireUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/exhibitor/${orgId}/horses`} className="hover:underline">
            My horses
          </Link>{" "}
          / Add horse
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Add a horse</h2>
      </div>
      <CreateOwnHorseForm organizationId={orgId} />
    </div>
  );
}
