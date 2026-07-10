"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createAssociationSchema,
  createClassCodeSchema,
  createEligibilityRuleSchema,
  createRulePackageSchema,
  type CreateAssociationInput,
  type CreateClassCodeInput,
  type CreateEligibilityRuleInput,
  type CreateRulePackageInput,
} from "@/lib/validation/rule-package";

export type ActionResult = { error?: string };

export async function createAssociation(
  input: CreateAssociationInput
): Promise<ActionResult> {
  const parsed = createAssociationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("associations")
    .insert({ organization_id: d.organizationId, name: d.name });

  if (error) {
    if (error.message.includes("associations_organization_id_name_key")) {
      return { error: "An association with that name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath(`/organizations/${d.organizationId}/rule-packages`);
  return {};
}

export async function createRulePackage(
  input: CreateRulePackageInput,
  organizationId: string
): Promise<ActionResult> {
  const parsed = createRulePackageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: assoc } = await supabase
    .from("associations")
    .select("organization_id")
    .eq("id", d.associationId)
    .maybeSingle();
  if (!assoc) return { error: "Association not found." };

  const { error } = await supabase.from("association_rule_packages").insert({
    association_id: d.associationId,
    organization_id: assoc.organization_id,
    year: d.year,
    version: d.version,
    source_notes: d.sourceNotes || null,
  });

  if (error) {
    if (error.message.includes("association_rule_packages_association_id_year_version_key")) {
      return { error: "A rule package with that year/version already exists." };
    }
    return { error: error.message };
  }

  revalidatePath(`/organizations/${organizationId}/rule-packages`);
  return {};
}

export async function setRulePackageStatus(
  packageId: string,
  status: string,
  organizationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_rule_package_status", {
    p_package: packageId,
    p_status: status,
  });
  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}/rule-packages`);
  revalidatePath(`/organizations/${organizationId}/rule-packages/${packageId}`);
  return {};
}

export async function createClassCode(
  input: CreateClassCodeInput
): Promise<ActionResult> {
  const parsed = createClassCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("association_class_codes").insert({
    rule_package_id: d.rulePackageId,
    code: d.code,
    name: d.name,
    discipline: d.discipline || null,
    division: d.division || null,
    is_youth: d.isYouth,
    is_amateur: d.isAmateur,
    is_open: d.isOpen,
    is_non_pro: d.isNonPro,
    counts_for_points: d.countsForPoints,
    counts_for_money: d.countsForMoney,
  });

  if (error) {
    if (error.message.includes("association_class_codes_rule_package_id_code_key")) {
      return { error: "That code already exists in this rule package." };
    }
    return { error: error.message };
  }

  revalidatePath(`/organizations`, "layout");
  return {};
}

export async function createEligibilityRule(
  input: CreateEligibilityRuleInput
): Promise<ActionResult> {
  const parsed = createEligibilityRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const appliesTo = d.appliesTo
    ? d.appliesTo.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("association_eligibility_rules").insert({
    rule_package_id: d.rulePackageId,
    rule_key: d.ruleKey,
    applies_to: appliesTo,
    conditions: [{ field: d.field, operator: d.operator, value: d.value ?? "" }],
    severity: d.severity,
    message: d.message,
  });

  if (error) {
    if (error.message.includes("association_eligibility_rules_rule_package_id_rule_key_key")) {
      return { error: "A rule with that key already exists in this package." };
    }
    return { error: error.message };
  }

  revalidatePath(`/organizations`, "layout");
  return {};
}
