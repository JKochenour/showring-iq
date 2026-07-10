import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { CreatePersonForm } from "@/components/org/person-form";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Add person — ShowRing IQ" };

export default async function NewPersonPage({
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

  const canCreate = await hasOrgPermission(id, "person.create");

  return (
    <div>
      <PageHeader
        title="Add person"
        description="One profile can hold several roles — a rider can also be an owner and trainer. Membership numbers are added on the person's page."
      />
      {canCreate ? (
        <CreatePersonForm organizationId={id} />
      ) : (
        <Alert tone="info">
          You don&apos;t have the person.create permission in this organization.
        </Alert>
      )}
    </div>
  );
}
