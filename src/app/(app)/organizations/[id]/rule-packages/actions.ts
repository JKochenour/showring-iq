"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission } from "@/lib/authz";
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
import { normalizeBoolean } from "@/lib/import/normalize";
import { dollarsToCents } from "@/lib/money";

export type ActionResult = { error?: string };

const MAX_IMPORT_ROWS = 1000;

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

export async function deleteClassCode(classCodeId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: code } = await supabase
    .from("association_class_codes")
    .select("rule_package_id, code, name, organization_id")
    .eq("id", classCodeId)
    .maybeSingle();
  if (!code) return { error: "Class code not found." };

  const { data: deleted, error } = await supabase
    .from("association_class_codes")
    .delete()
    .eq("id", classCodeId)
    .select("id");

  if (error) {
    if (error.message.includes("violates foreign key constraint")) {
      return { error: "This code is linked to one or more classes — unlink them first." };
    }
    return { error: error.message };
  }
  if (!deleted || deleted.length === 0) {
    return { error: "Delete was not applied. You may lack the rules.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: code.organization_id,
    p_action: "rule_package.class_code_deleted",
    p_entity_type: "association_class_code",
    p_entity_id: classCodeId,
    p_old: { code: code.code, name: code.name },
    p_new: null,
  });

  revalidatePath(`/organizations`, "layout");
  return {};
}

export async function deleteEligibilityRule(ruleId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: rule } = await supabase
    .from("association_eligibility_rules")
    .select("rule_package_id, rule_key, organization_id")
    .eq("id", ruleId)
    .maybeSingle();
  if (!rule) return { error: "Eligibility rule not found." };

  const { data: deleted, error } = await supabase
    .from("association_eligibility_rules")
    .delete()
    .eq("id", ruleId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Delete was not applied. You may lack the rules.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: rule.organization_id,
    p_action: "rule_package.eligibility_rule_deleted",
    p_entity_type: "association_eligibility_rule",
    p_entity_id: ruleId,
    p_old: { rule_key: rule.rule_key },
    p_new: null,
  });

  revalidatePath(`/organizations`, "layout");
  return {};
}

export async function deleteRulePackage(
  packageId: string,
  organizationId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("association_rule_packages")
    .select("status, year, version")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return { error: "Rule package not found." };
  if (pkg.status !== "draft") {
    return { error: "Only draft rule packages can be deleted. Archive it instead." };
  }

  const { data: deleted, error } = await supabase
    .from("association_rule_packages")
    .delete()
    .eq("id", packageId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Delete was not applied. You may lack the rules.edit permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: organizationId,
    p_action: "rule_package.deleted",
    p_entity_type: "association_rule_package",
    p_entity_id: packageId,
    p_old: { year: pkg.year, version: pkg.version },
    p_new: null,
  });

  revalidatePath(`/organizations/${organizationId}/rule-packages`);
  return {};
}

function optionalDollarsToCents(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  return dollarsToCents(value);
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
    max_added_money_cents: optionalDollarsToCents(d.maxAddedMoney),
    max_entry_fee_cents: optionalDollarsToCents(d.maxEntryFee),
    max_entry_fee_percent_of_added_money: d.maxEntryFeePercentOfAddedMoney ?? null,
    max_entry_fee_jackpot_cents: optionalDollarsToCents(d.maxEntryFeeJackpot),
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

/**
 * Seeds a draft "NRHA 2026" starter rule package: class names and
 * youth/amateur/open/non-pro flags come from NRHA's public class-category
 * taxonomy (nrha.com/education/navigating-categories/) — that's fine to
 * reuse. The actual numeric class codes live in NRHA's member-only
 * ReinerSuite/Handbook and are their material, not ours to scrape or
 * republish, so codes are seeded as clearly-marked placeholders (except
 * "5300" for Green Reiner Level 1, which is CLAUDE.md's own worked
 * example, not scraped data). The package stays in "draft" status —
 * confirm real codes against your NRHA Handbook/ReinerSuite access before
 * publishing, per the standard validation disclaimer.
 */
const STARTER_CLASSES: {
  code: string;
  name: string;
  division: string;
  isYouth: boolean;
  isAmateur: boolean;
  isOpen: boolean;
  isNonPro: boolean;
}[] = [
  { code: "CONFIRM-1", name: "Open", division: "Ancillary", isYouth: false, isAmateur: false, isOpen: true, isNonPro: false },
  { code: "CONFIRM-2", name: "Non Pro", division: "Ancillary", isYouth: false, isAmateur: false, isOpen: false, isNonPro: true },
  { code: "CONFIRM-3", name: "Intermediate Non Pro", division: "Ancillary", isYouth: false, isAmateur: false, isOpen: false, isNonPro: true },
  { code: "CONFIRM-4", name: "Limited Non Pro", division: "Ancillary", isYouth: false, isAmateur: false, isOpen: false, isNonPro: true },
  { code: "CONFIRM-5", name: "Novice Horse Open Level 1", division: "Ancillary", isYouth: false, isAmateur: false, isOpen: true, isNonPro: false },
  { code: "CONFIRM-6", name: "Novice Horse Non Pro Level 1", division: "Ancillary", isYouth: false, isAmateur: false, isOpen: false, isNonPro: true },
  { code: "CONFIRM-7", name: "Rookie Level 1", division: "Ancillary (Rookie)", isYouth: false, isAmateur: false, isOpen: false, isNonPro: false },
  { code: "5300", name: "Green Reiner Level 1", division: "Entry Level", isYouth: false, isAmateur: false, isOpen: false, isNonPro: false },
  { code: "CONFIRM-9", name: "Green Reiner Level 2", division: "Entry Level", isYouth: false, isAmateur: false, isOpen: false, isNonPro: false },
  { code: "CONFIRM-10", name: "Ride & Slide Level 1", division: "Entry Level", isYouth: false, isAmateur: false, isOpen: false, isNonPro: false },
  { code: "CONFIRM-11", name: "Ride & Slide Level 2", division: "Entry Level", isYouth: false, isAmateur: false, isOpen: false, isNonPro: false },
  { code: "CONFIRM-12", name: "Youth 13 & Under", division: "Youth", isYouth: true, isAmateur: false, isOpen: false, isNonPro: false },
  { code: "CONFIRM-13", name: "Youth 14-18", division: "Youth", isYouth: true, isAmateur: false, isOpen: false, isNonPro: false },
];

export async function createNrhaStarterPackage(
  organizationId: string,
  year: number
): Promise<ActionResult> {
  const supabase = await createClient();

  let { data: assoc } = await supabase
    .from("associations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "NRHA")
    .maybeSingle();

  if (!assoc) {
    const { data: created, error } = await supabase
      .from("associations")
      .insert({ organization_id: organizationId, name: "NRHA" })
      .select("id")
      .maybeSingle();
    if (error || !created) {
      return { error: error?.message ?? "Could not create the NRHA association." };
    }
    assoc = created;
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("association_rule_packages")
    .insert({
      association_id: assoc.id,
      organization_id: organizationId,
      year,
      version: "1",
      source_notes:
        "Starter package: class names and eligibility flags are from NRHA's public class-category taxonomy (nrha.com). Numeric codes are placeholders (CONFIRM-#) — replace with the real codes from your NRHA Handbook/ReinerSuite access before publishing. Not sourced from any scraped or copyrighted NRHA document.",
    })
    .select("id")
    .maybeSingle();

  if (pkgError || !pkg) {
    if (pkgError?.message.includes("association_rule_packages_association_id_year_version_key")) {
      return { error: `An NRHA ${year} v1 rule package already exists.` };
    }
    return { error: pkgError?.message ?? "Could not create the rule package." };
  }

  const { error: codesError } = await supabase.from("association_class_codes").insert(
    STARTER_CLASSES.map((c) => ({
      rule_package_id: pkg.id,
      code: c.code,
      name: c.name,
      discipline: "Reining",
      division: c.division,
      is_youth: c.isYouth,
      is_amateur: c.isAmateur,
      is_open: c.isOpen,
      is_non_pro: c.isNonPro,
    }))
  );
  if (codesError) return { error: codesError.message };

  const { error: ruleError } = await supabase.from("association_eligibility_rules").insert({
    rule_package_id: pkg.id,
    rule_key: "nrha_non_pro_ownership",
    applies_to: ["non_pro"],
    conditions: [{ field: "horse.ownedByRider", operator: "equals", value: "true" }],
    severity: "blocking",
    message:
      "Non Pro classes require the rider to be a listed owner of the horse — verify against your current NRHA Handbook.",
  });
  if (ruleError) return { error: ruleError.message };

  revalidatePath(`/organizations/${organizationId}/rule-packages`);
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

export type ImportRowResult = {
  row: number;
  name: string;
  status: "created" | "updated" | "error";
  message?: string;
};

export type ImportSummary = {
  created: number;
  updated: number;
  errors: number;
  results: ImportRowResult[];
};

export type ImportClassCodeRow = {
  code?: string;
  name?: string;
  discipline?: string;
  division?: string;
  isYouth?: string;
  isAmateur?: string;
  isOpen?: string;
  isNonPro?: string;
  countsForPoints?: string;
  countsForMoney?: string;
};

const importClassCodeRowSchema = createClassCodeSchema.omit({
  rulePackageId: true,
  isYouth: true,
  isAmateur: true,
  isOpen: true,
  isNonPro: true,
  countsForPoints: true,
  countsForMoney: true,
});

/**
 * Bulk create/update class codes in a rule package from an org's own
 * spreadsheet (e.g. transcribed from their NRHA Handbook for a new year).
 * Upserts by code within the package, so re-uploading a revised list
 * updates existing rows instead of duplicating them.
 */
export async function bulkImportClassCodes(
  rulePackageId: string,
  rows: ImportClassCodeRow[]
): Promise<ImportSummary | ActionResult> {
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("association_rule_packages")
    .select("organization_id")
    .eq("id", rulePackageId)
    .maybeSingle();
  if (!pkg) return { error: "Rule package not found." };

  if (!(await hasOrgPermission(pkg.organization_id, "rules.create"))) {
    return { error: "You don't have permission to edit rule packages in this organization." };
  }

  const { data: existing } = await supabase
    .from("association_class_codes")
    .select("id, code")
    .eq("rule_package_id", rulePackageId);
  const existingByCode = new Map((existing ?? []).map((c) => [c.code.toLowerCase(), c.id]));

  const input = rows.slice(0, MAX_IMPORT_ROWS);
  const results: ImportRowResult[] = [];

  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const rowNum = i + 1;
    const displayName = raw.name?.trim() || raw.code?.trim() || `Row ${rowNum}`;

    const parsed = importClassCodeRowSchema.safeParse({
      code: raw.code ?? "",
      name: raw.name ?? "",
      discipline: raw.discipline ?? "",
      division: raw.division ?? "",
    });
    if (!parsed.success) {
      results.push({
        row: rowNum,
        name: displayName,
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }
    const d = parsed.data;

    const record = {
      code: d.code,
      name: d.name,
      discipline: d.discipline || null,
      division: d.division || null,
      is_youth: normalizeBoolean(raw.isYouth, false),
      is_amateur: normalizeBoolean(raw.isAmateur, false),
      is_open: normalizeBoolean(raw.isOpen, false),
      is_non_pro: normalizeBoolean(raw.isNonPro, false),
      counts_for_points: normalizeBoolean(raw.countsForPoints, true),
      counts_for_money: normalizeBoolean(raw.countsForMoney, true),
    };

    const existingId = existingByCode.get(d.code.toLowerCase());
    if (existingId) {
      const { error } = await supabase
        .from("association_class_codes")
        .update(record)
        .eq("id", existingId);
      if (error) {
        results.push({ row: rowNum, name: displayName, status: "error", message: error.message });
        continue;
      }
      results.push({ row: rowNum, name: displayName, status: "updated" });
    } else {
      const { data: created, error } = await supabase
        .from("association_class_codes")
        .insert({ rule_package_id: rulePackageId, ...record })
        .select("id")
        .maybeSingle();
      if (error || !created) {
        results.push({
          row: rowNum,
          name: displayName,
          status: "error",
          message: error?.message ?? "Not created.",
        });
        continue;
      }
      existingByCode.set(d.code.toLowerCase(), created.id);
      results.push({ row: rowNum, name: displayName, status: "created" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const errors = results.filter((r) => r.status === "error").length;

  if (created + updated > 0) {
    await supabase.rpc("log_audit", {
      p_org: pkg.organization_id,
      p_action: "rule_package.class_codes_imported",
      p_entity_type: "association_rule_package",
      p_entity_id: rulePackageId,
      p_old: null,
      p_new: { created, updated, errors, source: "csv" },
    });
  }

  revalidatePath(`/organizations/${pkg.organization_id}/rule-packages/${rulePackageId}`);
  return { created, updated, errors, results };
}
