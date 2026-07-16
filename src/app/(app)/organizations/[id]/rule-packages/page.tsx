import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import {
  CreateAssociationForm,
  CreateRulePackageForm,
} from "@/components/org/rule-package-forms";
import { CreateAphaStarterButton } from "@/components/org/apha-starter-button";
import { CreateAqhaStarterButton } from "@/components/org/aqha-starter-button";
import { CreateNrhaStarterButton } from "@/components/org/nrha-starter-button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { VALIDATION_DISCLAIMER } from "@/lib/validation-engine";
import type { Association, RulePackage } from "@/lib/types";

export const metadata = { title: "Rule packages — ShowRing IQ" };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  review: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  tested: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  published: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
  deprecated: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  archived: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

export default async function RulePackagesPage({
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

  const [{ data: associations }, { data: packages }, canCreate] = await Promise.all([
    supabase
      .from("associations")
      .select("*")
      .eq("organization_id", id)
      .order("name"),
    supabase
      .from("association_rule_packages")
      .select("*, association:associations(name)")
      .eq("organization_id", id)
      .order("year", { ascending: false }),
    hasOrgPermission(id, "rules.create"),
  ]);

  const assocRows = (associations as Association[]) ?? [];
  const packageRows =
    (packages as unknown as (RulePackage & { association: { name: string } | null })[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rule packages"
        description="Association-specific class codes and eligibility rules, as versioned data. Link a class to a code (Classes → class detail) and published rule packages' eligibility rules run automatically on the Issues tab."
      />

      <Alert tone="info">
        Only <b>published</b> rule packages drive live validation on the Issues
        tab — draft/review/tested packages are safe to edit without affecting
        a real show. {VALIDATION_DISCLAIMER}
      </Alert>

      {canCreate && (
        <div className="grid gap-4 sm:grid-cols-2">
          <CreateAssociationForm organizationId={id} />
          <CreateRulePackageForm
            organizationId={id}
            associations={assocRows.map((a) => ({ id: a.id, name: a.name }))}
          />
        </div>
      )}

      {canCreate && <CreateNrhaStarterButton organizationId={id} />}
      {canCreate && <CreateAqhaStarterButton organizationId={id} />}
      {canCreate && <CreateAphaStarterButton organizationId={id} />}

      {packageRows.length === 0 ? (
        <EmptyState
          title="No rule packages yet"
          description="Add an association, then create a versioned rule package for it (e.g. NRHA 2026)."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Association</th>
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {packageRows.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/organizations/${id}/rule-packages/${pkg.id}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-500"
                      >
                        {pkg.association?.name ?? "Unknown"}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{pkg.year}</td>
                    <td className="py-3 pr-4">{pkg.version}</td>
                    <td className="py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[pkg.status]}`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
