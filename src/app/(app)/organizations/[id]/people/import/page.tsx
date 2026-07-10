import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { bulkImportPeople } from "@/app/(app)/organizations/[id]/people/actions";
import { SpreadsheetImport } from "@/components/org/spreadsheet-import";
import { PEOPLE_IMPORT_FIELDS } from "@/lib/import/field-config";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Import people — ShowRing IQ" };

const SAMPLE_ROW = {
  firstName: "Jamie",
  lastName: "Rivers",
  preferredName: "",
  email: "jamie@example.com",
  phone: "555-0101",
  city: "Weatherford",
  state: "TX",
  birthdate: "1994-03-12",
  roles: "Rider, Owner",
  membershipAssociation: "NRHA",
  membershipNumber: "123456",
  membershipStatus: "Active",
  notes: "",
};

export default async function ImportPeoplePage({
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
        title="Import people"
        description="Bulk-load your roster from a CSV export instead of entering everyone by hand. You can still add, edit, or remove people individually afterward."
      />
      {canCreate ? (
        <SpreadsheetImport
          organizationId={id}
          backHref={`/organizations/${id}/people`}
          entityLabelPlural="People"
          fields={PEOPLE_IMPORT_FIELDS}
          sampleRow={SAMPLE_ROW}
          runImport={bulkImportPeople}
        />
      ) : (
        <Alert tone="info">
          You don&apos;t have the person.create permission in this organization.
        </Alert>
      )}
    </div>
  );
}
