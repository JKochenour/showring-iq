import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import {
  AddClassCodeForm,
  AddEligibilityRuleForm,
} from "@/components/org/rule-package-forms";
import { RulePackageStatusActions } from "@/components/org/rule-package-status";
import {
  deleteClassCode,
  deleteEligibilityRule,
  deleteRulePackage,
} from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { RemoveButton } from "@/components/remove-button";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import type {
  AssociationClassCode,
  AssociationEligibilityRule,
  RulePackage,
} from "@/lib/types";

export const metadata = { title: "Rule package — ShowRing IQ" };

export default async function RulePackageDetailPage({
  params,
}: {
  params: Promise<{ id: string; packageId: string }>;
}) {
  const { id, packageId } = await params;
  const { supabase } = await requireUser();

  const { data: pkg } = await supabase
    .from("association_rule_packages")
    .select("*, association:associations(name)")
    .eq("id", packageId)
    .eq("organization_id", id)
    .maybeSingle();
  if (!pkg) notFound();

  const [{ data: classCodes }, { data: eligibilityRules }, canPublish, canCreate] =
    await Promise.all([
      supabase
        .from("association_class_codes")
        .select("*")
        .eq("rule_package_id", packageId)
        .order("code"),
      supabase
        .from("association_eligibility_rules")
        .select("*")
        .eq("rule_package_id", packageId)
        .order("rule_key"),
      hasOrgPermission(id, "rules.publish"),
      hasOrgPermission(id, "rules.create"),
    ]);

  const rulePkg = pkg as unknown as RulePackage & { association: { name: string } | null };
  const codes = (classCodes as AssociationClassCode[]) ?? [];
  const rules = (eligibilityRules as AssociationEligibilityRule[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/organizations/${id}/rule-packages`} className="hover:underline">
            Rule packages
          </Link>{" "}
          / {rulePkg.association?.name} {rulePkg.year}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {rulePkg.association?.name} {rulePkg.year} · v{rulePkg.version}
        </h2>
        {rulePkg.source_notes && (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {rulePkg.source_notes}
          </p>
        )}
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold">
          Lifecycle: <span className="capitalize">{rulePkg.status}</span>
        </h3>
        <RulePackageStatusActions
          packageId={packageId}
          organizationId={id}
          status={rulePkg.status}
          canPublish={canPublish}
        />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">
            Class codes ({codes.length})
          </h3>
          {canCreate && (
            <ButtonLink
              href={`/organizations/${id}/rule-packages/${packageId}/import-codes`}
              variant="secondary"
            >
              Import from spreadsheet
            </ButtonLink>
          )}
        </div>
        {codes.length === 0 ? (
          <EmptyState title="No class codes yet" />
        ) : (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Flags</th>
                  {canCreate && <th className="py-2 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 font-mono">{c.code}</td>
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2 pr-4 text-xs text-stone-500 dark:text-stone-400">
                      {[
                        c.is_youth && "Youth",
                        c.is_amateur && "Amateur",
                        c.is_open && "Open",
                        c.is_non_pro && "Non Pro",
                        c.counts_for_points && "Points",
                        c.counts_for_money && "Money",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    {canCreate && (
                      <td className="py-2">
                        <RemoveButton
                          action={deleteClassCode.bind(null, c.id)}
                          confirmText={`Remove code ${c.code} — ${c.name}?`}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canCreate && <AddClassCodeForm rulePackageId={packageId} />}
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-semibold">
          Eligibility rules ({rules.length})
        </h3>
        {rules.length === 0 ? (
          <EmptyState title="No eligibility rules yet" />
        ) : (
          <ul className="mb-4 divide-y divide-stone-200 dark:divide-stone-800">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{r.rule_key}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {r.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(", ")}
                    {" · "}
                    {r.severity}
                    {r.applies_to.length > 0 && ` · applies to ${r.applies_to.join(", ")}`}
                  </p>
                  <p className="text-sm">{r.message}</p>
                </div>
                {canCreate && (
                  <RemoveButton
                    action={deleteEligibilityRule.bind(null, r.id)}
                    confirmText={`Remove rule ${r.rule_key}?`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canCreate && <AddEligibilityRuleForm rulePackageId={packageId} />}
      </Card>

      {canCreate && rulePkg.status === "draft" && (
        <Card className="border-red-200 dark:border-red-900">
          <h3 className="mb-1 text-sm font-semibold">Danger zone</h3>
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
            Deleting removes this package and all its class codes and eligibility
            rules. Only draft packages can be deleted — send a package to review
            (or further) to protect it, or archive it instead.
          </p>
          <RemoveButton
            action={deleteRulePackage.bind(null, packageId, id)}
            label="Delete rule package"
            pendingLabel="Deleting…"
            confirmText={`Permanently delete ${rulePkg.association?.name} ${rulePkg.year} v${rulePkg.version}? This cannot be undone.`}
          />
        </Card>
      )}
    </div>
  );
}
