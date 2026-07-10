import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import {
  CreateAssociationForm,
  CreateRulePackageForm,
} from "@/components/org/rule-package-forms";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Association, RulePackage } from "@/lib/types";

export const metadata = { title: "Rule packages — ShowRing IQ" };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  review: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  tested: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  deprecated: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  archived: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
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
        description="Foundation for association-specific class codes and eligibility rules — versioned data, not hard-coded logic. Not yet wired into class/entry validation; classes still use the plain NRHA class code field."
      />

      <Alert tone="info">
        This is early groundwork per the architecture principle that association
        rules must be data, not code. Rule packages defined here aren&apos;t yet
        consulted by the Classes or Issues tabs — that wiring is future work.
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
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Association</th>
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {packageRows.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/organizations/${id}/rule-packages/${pkg.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-500"
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
