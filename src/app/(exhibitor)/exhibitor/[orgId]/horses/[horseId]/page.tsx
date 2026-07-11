import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { EditOwnHorseForm } from "@/components/exhibitor/horse-form";
import type { Horse } from "@/lib/types";

export const metadata = { title: "Horse — ShowRing IQ" };

export default async function ExhibitorHorseDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; horseId: string }>;
}) {
  const { orgId, horseId } = await params;
  const { supabase } = await requireUser();

  const { data: horse } = await supabase
    .from("horses")
    .select("*")
    .eq("id", horseId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!horse) notFound();
  const h = horse as Horse;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/exhibitor/${orgId}/horses`} className="hover:underline">
            My horses
          </Link>{" "}
          / {h.registered_name}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {h.registered_name}
          {h.barn_name && (
            <span className="ml-2 text-base font-normal text-stone-500 dark:text-stone-400">
              “{h.barn_name}”
            </span>
          )}
        </h2>
      </div>
      <EditOwnHorseForm horse={h} organizationId={orgId} />
    </div>
  );
}
