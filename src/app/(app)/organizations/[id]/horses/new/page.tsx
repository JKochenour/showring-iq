import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { CreateHorseForm } from "@/components/org/horse-form";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Add horse — ShowRing IQ" };

export default async function NewHorsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const canCreate = await hasOrgPermission(id, "horse.create");

  return (
    <div>
      <PageHeader
        title="Add horse"
        description="Registration numbers, competition licenses, and owners are added on the horse's page."
      />
      {canCreate ? (
        <CreateHorseForm organizationId={id} />
      ) : (
        <Alert tone="info">
          You don&apos;t have the horse.create permission in this organization.
        </Alert>
      )}
    </div>
  );
}
