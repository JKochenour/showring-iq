import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { bulkImportClassCodes } from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { SpreadsheetImport } from "@/components/org/spreadsheet-import";
import { CLASS_CODE_IMPORT_FIELDS } from "@/lib/import/field-config";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Import class codes — ShowRing IQ" };

const SAMPLE_ROW = {
  code: "5300",
  name: "Green Reiner Level 1",
  discipline: "Reining",
  division: "Entry Level",
  isYouth: "N",
  isAmateur: "N",
  isOpen: "N",
  isNonPro: "N",
  countsForPoints: "Y",
  countsForMoney: "Y",
};

export default async function ImportClassCodesPage({
  params,
}: {
  params: Promise<{ id: string; packageId: string }>;
}) {
  const { id, packageId } = await params;
  const { supabase } = await requireUser();

  const { data: pkg } = await supabase
    .from("association_rule_packages")
    .select("id, year, version, organization_id, association:associations(name)")
    .eq("id", packageId)
    .eq("organization_id", id)
    .maybeSingle();
  if (!pkg) notFound();

  const pkgLabel = `${(pkg.association as unknown as { name: string } | null)?.name ?? "?"} ${pkg.year}·v${pkg.version}`;
  const canImport = await hasOrgPermission(id, "rules.create");
  const backHref = `/organizations/${id}/rule-packages/${packageId}`;

  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href={backHref} className="hover:underline">
          {pkgLabel}
        </Link>
      </p>
      <PageHeader
        title={`Import class codes — ${pkgLabel}`}
        description="Upload your own official class-code list (transcribed or downloaded from your NRHA Handbook/ReinerSuite access) to bulk-create or update codes in this package for a new year. Matches existing rows by code, so re-uploading a revised list updates them instead of duplicating."
      />
      {canImport ? (
        <SpreadsheetImport
          scopeId={packageId}
          backHref={backHref}
          entityLabelPlural="class codes"
          fields={CLASS_CODE_IMPORT_FIELDS}
          sampleRow={SAMPLE_ROW}
          runImport={bulkImportClassCodes}
        />
      ) : (
        <Alert tone="info">
          You don&apos;t have the rules.create permission in this organization.
        </Alert>
      )}
    </div>
  );
}
