import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { CreateShowForm } from "@/components/show/create-show-form";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "New show — ShowRing IQ" };

export default async function NewShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const canCreate = await hasOrgPermission(id, "show.create");

  return (
    <div>
      <PageHeader
        title="Create show"
        description="Shows start as drafts. Publish when setup is ready; affiliations and classes come in the next sprints."
      />
      {canCreate ? (
        <CreateShowForm organizationId={id} />
      ) : (
        <Alert tone="info">
          You don&apos;t have the show.create permission in this organization.
        </Alert>
      )}
    </div>
  );
}
