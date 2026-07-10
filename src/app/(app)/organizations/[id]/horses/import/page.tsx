import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { bulkImportHorses } from "@/app/(app)/organizations/[id]/horses/actions";
import { SpreadsheetImport } from "@/components/org/spreadsheet-import";
import { HORSE_IMPORT_FIELDS } from "@/lib/import/field-config";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Import horses — ShowRing IQ" };

const SAMPLE_ROW = {
  registeredName: "Shiners Certain Lady",
  barnName: "Lady",
  breed: "Quarter Horse",
  sex: "Mare",
  color: "Chestnut",
  foalYear: "2018",
  sire: "Shining Spark",
  dam: "Certain Potential",
  ownerName: "Jamie Rivers",
  ownerPercentage: "100",
  registrationAssociation: "NRHA",
  registrationNumber: "1234567",
  competitionLicenseNumber: "",
  registrationStatus: "Active",
  notes: "",
};

export default async function ImportHorsesPage({
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
        title="Import horses"
        description="Bulk-load your horse database from a CSV export instead of entering every horse by hand. For co-owned horses, use one row per owner (same registration number or horse name) — each row adds that owner rather than being skipped as a duplicate. Owner name is matched against existing people by exact name — add ownership manually for anyone not matched. You can still add, edit, or remove horses individually afterward."
      />
      {canCreate ? (
        <SpreadsheetImport
          organizationId={id}
          backHref={`/organizations/${id}/horses`}
          entityLabelPlural="Horses"
          fields={HORSE_IMPORT_FIELDS}
          sampleRow={SAMPLE_ROW}
          runImport={bulkImportHorses}
        />
      ) : (
        <Alert tone="info">
          You don&apos;t have the horse.create permission in this organization.
        </Alert>
      )}
    </div>
  );
}
