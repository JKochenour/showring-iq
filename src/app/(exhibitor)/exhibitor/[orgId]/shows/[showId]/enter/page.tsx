import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import {
  evaluateEligibilityRulesForAffiliations,
  type AffiliationEligibilityInput,
  type EligibilityRuleLike,
} from "@/lib/rule-package-engine";
import { VALIDATION_DISCLAIMER } from "@/lib/validation-engine";
import { ExhibitorEntryForm, type EntryClassOption } from "@/components/exhibitor/entry-form";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Enter show — ShowRing IQ" };

function ageAt(birthdate: string, atDate: string): number {
  const b = new Date(birthdate);
  const a = new Date(atDate);
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const m = a.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export default async function ExhibitorEnterShowPage({
  params,
}: {
  params: Promise<{ orgId: string; showId: string }>;
}) {
  const { orgId, showId } = await params;
  const { supabase, user } = await requireUser();

  const [{ data: show }, { data: person }, { data: horses }, { data: classes }, { data: rules }] =
    await Promise.all([
      supabase
        .from("shows")
        .select("id, name, start_date, end_date, status")
        .eq("id", showId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("people")
        .select("id, birthdate")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("horses")
        .select("id, registered_name, barn_name")
        .eq("organization_id", orgId)
        .order("registered_name"),
      supabase
        .from("classes")
        .select(
          `id, class_number, name, entry_fee_cents, class_code_id,
           legacy_code:association_class_codes(code, is_youth, is_amateur, is_open, is_non_pro, rule_package_id, rule_package:association_rule_packages(association:associations(name))),
           affiliations:class_affiliations(association_class_code_id, code:association_class_codes(code, is_youth, is_amateur, is_open, is_non_pro, rule_package_id, rule_package:association_rule_packages(association:associations(name))))`
        )
        .eq("show_id", showId)
        .not("status", "in", "(cancelled,archived,entry_closed)")
        .order("display_order"),
      supabase
        .from("association_eligibility_rules")
        .select(
          "id, rule_key, applies_to, conditions, severity, message, rule_package_id, rule_package:association_rule_packages!inner(status)"
        )
        .eq("organization_id", orgId)
        .eq("rule_package.status", "published"),
    ]);

  if (!show) notFound();
  if (show.status !== "published") {
    return (
      <div>
        <PageHeader title={show.name} />
        <Alert tone="info">This show isn&apos;t open for self-service entry right now.</Alert>
      </div>
    );
  }
  if (!person) notFound();

  type CodeRow = {
    code: string;
    is_youth: boolean;
    is_amateur: boolean;
    is_open: boolean;
    is_non_pro: boolean;
    rule_package_id: string;
    rule_package: { association: { name: string } | null } | null;
  };
  type ClassRow = {
    id: string;
    class_number: number;
    name: string;
    entry_fee_cents: number;
    class_code_id: string | null;
    legacy_code: CodeRow | null;
    affiliations: { association_class_code_id: string; code: CodeRow | null }[] | null;
  };
  type RuleRow = {
    id: string;
    rule_key: string;
    applies_to: string[];
    conditions: { field: string; operator: string; value: string }[];
    severity: "info" | "warning" | "blocking" | "critical";
    message: string;
    rule_package_id: string;
  };

  const ruleRows: EligibilityRuleLike[] = ((rules as unknown as RuleRow[]) ?? []).map((r) => ({
    id: r.id,
    ruleKey: r.rule_key,
    appliesTo: r.applies_to ?? [],
    conditions: r.conditions ?? [],
    severity: r.severity,
    message: r.message,
    rulePackageId: r.rule_package_id,
  }));

  function toAffiliation(code: CodeRow): AffiliationEligibilityInput {
    return {
      rulePackageId: code.rule_package_id,
      associationName: code.rule_package?.association?.name,
      codeFlags: {
        code: code.code,
        isYouth: code.is_youth,
        isAmateur: code.is_amateur,
        isOpen: code.is_open,
        isNonPro: code.is_non_pro,
        rulePackageId: code.rule_package_id,
        associationName: code.rule_package?.association?.name,
      },
    };
  }

  const riderAge = person.birthdate ? ageAt(person.birthdate, show.start_date) : null;
  const context = {
    rider: { age: riderAge },
    entry: { hasOwner: true, ownerIsRider: true },
    horse: { ownershipCount: 1, ownedByRider: true },
  };

  const classOptions: EntryClassOption[] = ((classes as unknown as ClassRow[]) ?? []).map((c) => {
    const affiliationRows = c.affiliations ?? [];
    const affiliations: AffiliationEligibilityInput[] =
      affiliationRows.length > 0
        ? affiliationRows.filter((r) => r.code).map((r) => toAffiliation(r.code as CodeRow))
        : c.class_code_id && c.legacy_code
          ? [toAffiliation(c.legacy_code)]
          : [];
    const issues = evaluateEligibilityRulesForAffiliations(ruleRows, context, affiliations);
    const blocking = issues.filter((i) => i.severity === "blocking" || i.severity === "critical");
    return {
      id: c.id,
      classNumber: c.class_number,
      name: c.name,
      feeCents: c.entry_fee_cents,
      eligible: blocking.length === 0,
      reasons: issues.map((i) => i.message),
    };
  });

  const horseOptions = (horses ?? []).map((h) => ({
    id: h.id,
    label: h.barn_name ? `${h.registered_name} ("${h.barn_name}")` : h.registered_name,
  }));

  return (
    <div>
      <PageHeader
        title={`Enter — ${show.name}`}
        description={`${show.start_date}${show.end_date && show.end_date !== show.start_date ? ` – ${show.end_date}` : ""}. Eligible classes are checked by default; ineligible classes show why. ${VALIDATION_DISCLAIMER}`}
      />
      {horseOptions.length === 0 ? (
        <Alert tone="info">
          You don&apos;t have any horses on file yet. Ask the show office to add you as an owner
          before entering.
        </Alert>
      ) : (
        <ExhibitorEntryForm
          organizationId={orgId}
          showId={showId}
          horses={horseOptions}
          classes={classOptions}
        />
      )}
    </div>
  );
}
