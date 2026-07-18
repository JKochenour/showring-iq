"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission } from "@/lib/authz";
import {
  createAssociationSchema,
  createClassCodeSchema,
  createEligibilityRuleSchema,
  createRulePackageSchema,
  updateClassCodeSchema,
  updatePointsScheduleSchema,
  type CreateAssociationInput,
  type CreateClassCodeInput,
  type CreateEligibilityRuleInput,
  type CreateRulePackageInput,
  type UpdateClassCodeInput,
  type UpdatePointsScheduleInput,
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

export async function updatePointsSchedule(
  input: UpdatePointsScheduleInput,
  organizationId: string
): Promise<ActionResult> {
  const parsed = updatePointsScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("association_rule_packages")
    .update({ points_schedule: d.schedule })
    .eq("id", d.rulePackageId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error: "Update was not applied. You may lack the rules.edit permission.",
    };
  }

  revalidatePath(`/organizations/${organizationId}/rule-packages/${d.rulePackageId}`);
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

export async function updateClassCode(
  input: UpdateClassCodeInput
): Promise<ActionResult> {
  const parsed = updateClassCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("association_class_codes")
    .update({
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
    })
    .eq("id", d.classCodeId)
    .select("id");

  if (error) {
    if (error.message.includes("association_class_codes_rule_package_id_code_key")) {
      return { error: "That code already exists in this rule package." };
    }
    return { error: error.message };
  }
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. You may lack the rules.edit permission.",
    };
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
  // Was seeded as "5300", which is wrong and worse than a placeholder
  // because it looks confirmed: 5300 is Rookie Level 1 in NRHA's own
  // catalog, not Green Reiner Level 1. Back to a CONFIRM- placeholder
  // like its neighbours until someone checks it against the handbook.
  { code: "CONFIRM-8", name: "Green Reiner Level 1", division: "Entry Level", isYouth: false, isAmateur: false, isOpen: false, isNonPro: false },
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

  // Ownership checks, as WARNINGS.
  //
  // This used to be one BLOCKING rule requiring horse.ownedByRider, which
  // was wrong in two ways. NRHA allows the horse to be owned by the Non
  // Pro OR their immediate family OR a business entity they solely own,
  // so demanding the rider be the owner blocks legitimate entries — a
  // Non Pro on their spouse's horse — at the moment the office can least
  // afford it. And the engine cannot see family relationships at all, so
  // the strongest honest check is that an owner is recorded, with the
  // relationship verified by hand. Same call the AQHA and APHA packages
  // made for their ownership rules.
  //
  // Scoped by the non_pro/youth CATEGORY, which is safe against this
  // catalog: Rookie, Green Reiner and Ride & Slide are all isNonPro:
  // false here, and NRHA exempts exactly those from ownership rules. If
  // you later import NRHA's real codes, note that Ride & Slide Non Pro
  // DOES carry the non-pro flag — scope by explicit code then, the way
  // scripts/nrha-eligibility-rules.sql does.
  //
  // Age rules (Youth 13 & Under, Youth 14-18, Prime Time 50+, Masters
  // 60+, Legends 70+) are deliberately NOT seeded here: they have to
  // target individual codes, and this catalog is still CONFIRM-
  // placeholders. See scripts/nrha-eligibility-rules.sql for the
  // transcribed set to apply once real codes are in.
  const { error: ruleError } = await supabase
    .from("association_eligibility_rules")
    .insert([
      {
        rule_package_id: pkg.id,
        rule_key: "nrha_non_pro_ownership_recorded",
        applies_to: ["non_pro"],
        conditions: [{ field: "entry.hasOwner", operator: "equals", value: "true" }],
        severity: "warning",
        message:
          "Non Pro: record the horse's owner. NRHA requires the horse to be owned solely by the Non Pro, their immediate family, or a business entity they solely own — verify the relationship against your current NRHA Handbook.",
      },
      {
        rule_package_id: pkg.id,
        rule_key: "nrha_youth_ownership_recorded",
        applies_to: ["youth"],
        conditions: [{ field: "entry.hasOwner", operator: "equals", value: "true" }],
        severity: "warning",
        message:
          "Youth class: record the horse's owner. NRHA requires the horse to be owned solely by the youth, their immediate family, or a business entity they solely own — verify the relationship against your current NRHA Handbook.",
      },
    ]);
  if (ruleError) return { error: ruleError.message };

  revalidatePath(`/organizations/${organizationId}/rule-packages`);
  return {};
}

/**
 * Seeds a draft "AQHA <year>" starter rule package, transcribed from the
 * organization's own copy of the official AQHA 2026 Handbook (Show Rules
 * SHW section) — factual class/division/eligibility data with SHW rule
 * citations, entered the same way the NRHA payback schedules and
 * patterns were transcribed from the org's own official PDFs. Class
 * catalog follows the Achievement Awards table (SHW805) plus the
 * per-class division rules; SHW416.1 is the canonical division
 * template. The `code` values are INTERNAL mnemonics — align them with
 * your AQHA results-software class codes before publishing/submitting.
 */
const AQHA_STARTER_CLASSES: {
  code: string;
  name: string;
  discipline: string;
  division: string;
  isYouth: boolean;
  isAmateur: boolean;
  isOpen: boolean;
}[] = [
  // Halter (SHW350/365; youth halter is mares & geldings only, SHW118.1)
  { code: "HALT-O", name: "Halter", discipline: "Halter", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "PHALT-O", name: "Performance Halter", discipline: "Halter", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HALT-AM", name: "Amateur Halter", discipline: "Halter", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HALT-Y", name: "Youth Halter (mares & geldings)", discipline: "Halter", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Western Pleasure (SHW402/403; junior/senior/2yo splits per SHW112.3)
  { code: "WP-O", name: "Western Pleasure", discipline: "Western Pleasure", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WP-O-L1", name: "Level 1 Western Pleasure", discipline: "Western Pleasure", division: "Open · Level 1 (horse)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WP-O-2YO", name: "2-Year-Old Western Pleasure", discipline: "Western Pleasure", division: "Open (not before July 1, SHW403)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WP-AM", name: "Amateur Western Pleasure", discipline: "Western Pleasure", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WP-SEL", name: "Select Western Pleasure", discipline: "Western Pleasure", division: "Select Amateur (50+)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WP-Y", name: "Youth Western Pleasure", discipline: "Western Pleasure", division: "Youth (age splits per SHW118.5)", isYouth: true, isAmateur: false, isOpen: false },
  // Hunter Under Saddle (SHW601)
  { code: "HUS-O", name: "Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HUS-AM", name: "Amateur Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HUS-Y", name: "Youth Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Trail (SHW461; no cross-enter with Ranch Trail, SHW421.1)
  { code: "TRAIL-O", name: "Trail", discipline: "Trail", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "TRAIL-AM", name: "Amateur Trail", discipline: "Trail", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "TRAIL-Y", name: "Youth Trail", discipline: "Trail", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Western Riding (SHW451)
  { code: "WR-O", name: "Western Riding", discipline: "Western Riding", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WR-AM", name: "Amateur Western Riding", discipline: "Western Riding", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WR-Y", name: "Youth Western Riding", discipline: "Western Riding", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Ranch classes (SHW416 ranch riding — horses 3+, SHW112.4; SHW421 ranch trail)
  { code: "RR-O", name: "Ranch Riding", discipline: "Ranch Riding", division: "Open (horses 3+)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "RR-O-L1", name: "Level 1 Ranch Riding", discipline: "Ranch Riding", division: "Open · Level 1 (horse)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "RR-AM", name: "Amateur Ranch Riding", discipline: "Ranch Riding", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "RR-SEL", name: "Select Ranch Riding", discipline: "Ranch Riding", division: "Select Amateur (50+)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "RR-Y", name: "Youth Ranch Riding", discipline: "Ranch Riding", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "RTRAIL-O", name: "Ranch Trail", discipline: "Ranch Trail", division: "Open (horses 3+)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "RTRAIL-AM", name: "Amateur Ranch Trail", discipline: "Ranch Trail", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  // Reining (SHW480; no cross-enter with VRH reining, SHW481.1)
  { code: "REIN-O", name: "Reining", discipline: "Reining", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "REIN-O-L1", name: "Level 1 Reining", discipline: "Reining", division: "Open · Level 1 (horse)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "REIN-AM", name: "Amateur Reining", discipline: "Reining", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "REIN-SEL", name: "Select Reining", discipline: "Reining", division: "Select Amateur (50+)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "REIN-Y", name: "Youth Reining", discipline: "Reining", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Cow work (SHW505/509 WCH; SHW519 boxing = amateur/select/youth only)
  { code: "WCH-O", name: "Working Cow Horse", discipline: "Working Cow Horse", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WCH-AM", name: "Amateur Working Cow Horse", discipline: "Working Cow Horse", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "BOX-AM", name: "Amateur Boxing", discipline: "Working Cow Horse", division: "Amateur (eligibility SHW519.1)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "BOX-Y", name: "Youth Boxing", discipline: "Working Cow Horse", division: "Youth (eligibility SHW519.1)", isYouth: true, isAmateur: false, isOpen: false },
  { code: "CUT-O", name: "Cutting", discipline: "Cutting", division: "Open (NCHA rules, SHW500)", isYouth: false, isAmateur: false, isOpen: true },
  // Equitation classes — amateur/youth only (SHW371/431/616/645)
  { code: "SHOW-AM", name: "Amateur Showmanship at Halter", discipline: "Showmanship", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "SHOW-Y", name: "Youth Showmanship at Halter", discipline: "Showmanship", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "HMS-AM", name: "Amateur Western Horsemanship", discipline: "Horsemanship", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HMS-Y", name: "Youth Western Horsemanship", discipline: "Horsemanship", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "HSE-AM", name: "Amateur Hunt Seat Equitation", discipline: "Hunt Seat Equitation", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HSE-Y", name: "Youth Hunt Seat Equitation", discipline: "Hunt Seat Equitation", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Speed events (SHW700/703; stake race youth/amateur/select only, SHW710)
  { code: "BARREL-O", name: "Barrel Racing", discipline: "Speed Events", division: "Open (all-age)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "BARREL-Y", name: "Youth Barrel Racing", discipline: "Speed Events", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "POLE-O", name: "Pole Bending", discipline: "Speed Events", division: "Open (all-age)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "STAKE-Y", name: "Youth Stake Race", discipline: "Speed Events", division: "Youth (youth/amateur/select only, SHW710)", isYouth: true, isAmateur: false, isOpen: false },
  // Cattle team events (SHW540/547 — all-age, SHW112.5)
  { code: "PEN-O", name: "Team Penning", discipline: "Team Penning", division: "Open (all-age)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "SORT-O", name: "Ranch Sorting", discipline: "Ranch Sorting", division: "Open (all-age)", isYouth: false, isAmateur: false, isOpen: true },
  // Over fences (SHW625/636/656)
  { code: "WH-O", name: "Working Hunter", discipline: "Over Fences", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HH-O", name: "Hunter Hack", discipline: "Over Fences", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "JMP-O", name: "Jumping", discipline: "Over Fences", division: "Open (all-age, SHW656)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "EOF-AM", name: "Amateur Equitation Over Fences", discipline: "Over Fences", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
];

export async function createAqhaStarterPackage(
  organizationId: string,
  year: number
): Promise<ActionResult> {
  const supabase = await createClient();

  let { data: assoc } = await supabase
    .from("associations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "AQHA")
    .maybeSingle();

  if (!assoc) {
    const { data: created, error } = await supabase
      .from("associations")
      .insert({ organization_id: organizationId, name: "AQHA" })
      .select("id")
      .maybeSingle();
    if (error || !created) {
      return { error: error?.message ?? "Could not create the AQHA association." };
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
        "Starter package transcribed from the organization's own copy of the official AQHA 2026 Handbook, Show Rules (SHW) section. Class catalog follows the Achievement Awards categories (SHW805) and per-class division rules; eligibility rules cite their SHW numbers. Codes are internal mnemonics — align with your AQHA results-software class codes before publishing. Key operational data points: points chart SHW261 (no points under 3 shown); results due within 10 business days of closing, min $50/day fine after (SHW126.5); $10/horse/show-number processing fee (SHW120.2); error fines SHW126.6; rookie caps 10 pts (exhibitor) / 50 pts (horse) / $5,000 (SHW252.1); open Level 1 horse caps 25 pts / $2,500 per class (e.g. SHW401.3, SHW655.2).",
    })
    .select("id")
    .maybeSingle();

  if (pkgError || !pkg) {
    if (pkgError?.message.includes("association_rule_packages_association_id_year_version_key")) {
      return { error: `An AQHA ${year} v1 rule package already exists.` };
    }
    return { error: pkgError?.message ?? "Could not create the rule package." };
  }

  const { error: codesError } = await supabase.from("association_class_codes").insert(
    AQHA_STARTER_CLASSES.map((c) => ({
      rule_package_id: pkg.id,
      code: c.code,
      name: c.name,
      discipline: c.discipline,
      division: c.division,
      is_youth: c.isYouth,
      is_amateur: c.isAmateur,
      is_open: c.isOpen,
      is_non_pro: false,
    }))
  );
  if (codesError) return { error: codesError.message };

  // Eligibility rules expressed in the engine's current vocabulary
  // (rider.age, ownership). Where AQHA's rule is broader than the engine
  // can check (immediate-family ownership, age as of Jan 1), the rule is
  // a WARNING with the SHW citation so the office verifies by hand.
  const { error: rulesError } = await supabase.from("association_eligibility_rules").insert([
    {
      rule_package_id: pkg.id,
      rule_key: "aqha_youth_age",
      applies_to: ["youth"],
      conditions: [{ field: "rider.age", operator: "less_than", value: "19" }],
      severity: "warning",
      message:
        "AQHA youth exhibitors may compete through the calendar year in which they turn 19 (SHW118.4, age as of January 1) — verify this rider's AQHYA eligibility.",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "aqha_youth_amateur_ownership",
      applies_to: ["youth", "amateur"],
      conditions: [{ field: "horse.ownedByRider", operator: "equals", value: "true" }],
      severity: "warning",
      message:
        "AQHA youth/amateur classes require the horse to be solely owned by the exhibitor or their immediate family (SHW220) — the rider isn't a listed owner, so verify the family/lease relationship (leases must be AQHA-recorded, SHW240). Rookie and Level 1 amateur/youth are exempt (SHW252.2, SHW245.7).",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "aqha_amateur_age",
      applies_to: ["amateur"],
      conditions: [{ field: "rider.age", operator: "greater_than", value: "18" }],
      severity: "warning",
      message:
        "AQHA amateurs must be 19 on or before January 1 of the current year and no longer youth-eligible (SHW225.1).",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "aqha_select_age",
      applies_to: ["WP-SEL", "RR-SEL", "REIN-SEL"],
      conditions: [{ field: "rider.age", operator: "greater_than", value: "49" }],
      severity: "warning",
      message:
        "Select amateur classes are for exhibitors aged 50 and over (SHW225.2).",
    },
  ]);
  if (rulesError) return { error: rulesError.message };

  revalidatePath(`/organizations/${organizationId}/rule-packages`);
  return {};
}

/**
 * Seeds a draft "APHA <year>" starter rule package, transcribed from the
 * organization's own copy of the official APHA 2026 Rule Book — the same
 * transcription approach as the AQHA starter. Class catalog follows the
 * SC-190.A approved-events list plus the halter slate (SC-175.M) across
 * the APHA divisions (Open / Amateur / Masters 45+ / Novice Amateur /
 * Youth 18 & Under / Youth 13 & Under / Novice Youth / Walk-Trot /
 * Green). The APHA rulebook publishes class NAMES only — no class codes
 * exist in it — so the `code` values are INTERNAL mnemonics; align them
 * with the APHA Performance Department's electronic-results format
 * (SC-125.A) before publishing/submitting.
 */
const APHA_STARTER_CLASSES: {
  code: string;
  name: string;
  discipline: string;
  division: string;
  isYouth: boolean;
  isAmateur: boolean;
  isOpen: boolean;
  countsForPoints?: boolean;
}[] = [
  // Halter (SC-175; one point-earning open halter class per horse, SC-175.D)
  { code: "HALT-O", name: "Halter", discipline: "Halter", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "PHALT-O", name: "Performance Halter", discipline: "Halter", division: "Open (needs a performance class at the same show, SC-175.M.7)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "COLOR-O", name: "Color Class (Overo/Tobiano)", discipline: "Halter", division: "Open (Regular Registry only, SC-176.A)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HALT-AM", name: "Amateur Halter", discipline: "Halter", division: "Amateur (AM-090)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HALT-Y", name: "Youth Halter", discipline: "Halter", division: "Youth (no stallions, YP-080.B)", isYouth: true, isAmateur: false, isOpen: false },
  // Showmanship — amateur/youth only (AM-095.C, YP-090)
  { code: "SHOW-AM", name: "Amateur Showmanship at Halter", discipline: "Showmanship", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "SHOW-Y", name: "Youth Showmanship at Halter", discipline: "Showmanship", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Western Pleasure (SC-190.A; Green eligibility SC-246)
  { code: "WP-O", name: "Western Pleasure", discipline: "Western Pleasure", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WP-GR", name: "Green Western Pleasure", discipline: "Western Pleasure", division: "Green (horse eligibility, SC-246.D)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WP-AM", name: "Amateur Western Pleasure", discipline: "Western Pleasure", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WP-MAS", name: "Masters Amateur Western Pleasure", discipline: "Western Pleasure", division: "Masters Amateur (45+, AM-080.A.2.b)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WP-NAM", name: "Novice Amateur Western Pleasure", discipline: "Western Pleasure", division: "Novice Amateur (AM-205)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WP-Y", name: "Youth Western Pleasure", discipline: "Western Pleasure", division: "Youth 18 & Under (YP-075.A)", isYouth: true, isAmateur: false, isOpen: false },
  { code: "WP-Y13", name: "Youth Western Pleasure 13 & Under", discipline: "Western Pleasure", division: "Youth 13 & Under (YP-075.A)", isYouth: true, isAmateur: false, isOpen: false },
  { code: "WP-NY", name: "Novice Youth Western Pleasure", discipline: "Western Pleasure", division: "Novice Youth (YP-205)", isYouth: true, isAmateur: false, isOpen: false },
  // Walk-Trot (AM-300; YP-109 — no lope class anywhere all year)
  { code: "WTWP-AM", name: "Amateur Walk-Trot Western Pleasure", discipline: "Western Pleasure", division: "Amateur Walk-Trot (AM-300.G)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WTWP-Y", name: "Youth Walk-Trot Western Pleasure 11-18", discipline: "Western Pleasure", division: "Youth Walk-Trot 11-18 (YP-109)", isYouth: true, isAmateur: false, isOpen: false },
  // Hunter Under Saddle (Green eligibility SC-206)
  { code: "HUS-O", name: "Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HUS-GR", name: "Green Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Green (horse eligibility, SC-206)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HUS-AM", name: "Amateur Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HUS-Y", name: "Youth Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "HUS-NY", name: "Novice Youth Hunter Under Saddle", discipline: "Hunter Under Saddle", division: "Novice Youth (YP-205)", isYouth: true, isAmateur: false, isOpen: false },
  // Equitation / Horsemanship — amateur/youth only (AM-095.B, YP-090.C)
  { code: "HSE-AM", name: "Amateur Hunt Seat Equitation", discipline: "Hunt Seat Equitation", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HSE-Y", name: "Youth Hunt Seat Equitation", discipline: "Hunt Seat Equitation", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "HMS-AM", name: "Amateur Western Horsemanship", discipline: "Horsemanship", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "HMS-Y", name: "Youth Western Horsemanship", discipline: "Horsemanship", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Trail (Green eligibility SC-251)
  { code: "TRAIL-O", name: "Trail", discipline: "Trail", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "TRAIL-GR", name: "Green Trail", discipline: "Trail", division: "Green (horse eligibility, SC-251)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "TRAIL-AM", name: "Amateur Trail", discipline: "Trail", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "TRAIL-Y", name: "Youth Trail", discipline: "Trail", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "TRAIL-NY", name: "Novice Youth Trail", discipline: "Trail", division: "Novice Youth (YP-205)", isYouth: true, isAmateur: false, isOpen: false },
  // Western Riding (Green eligibility SC-256)
  { code: "WR-O", name: "Western Riding", discipline: "Western Riding", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WR-GR", name: "Green Western Riding", discipline: "Western Riding", division: "Green (horse eligibility, SC-256)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "WR-AM", name: "Amateur Western Riding", discipline: "Western Riding", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "WR-Y", name: "Youth Western Riding", discipline: "Western Riding", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Reining (Green eligibility SC-261; restricted specialty judges 60 days ahead, JU-000.C.2.c)
  { code: "REIN-O", name: "Reining", discipline: "Reining", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "REIN-GR", name: "Green Reining", discipline: "Reining", division: "Green (horse eligibility, SC-261)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "REIN-AM", name: "Amateur Reining", discipline: "Reining", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "REIN-NAM", name: "Novice Amateur Reining", discipline: "Reining", division: "Novice Amateur (AM-205)", isYouth: false, isAmateur: true, isOpen: false },
  { code: "REIN-Y", name: "Youth Reining", discipline: "Reining", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "REIN-NY", name: "Novice Youth Reining", discipline: "Reining", division: "Novice Youth (YP-205)", isYouth: true, isAmateur: false, isOpen: false },
  // Ranch classes (SC-190.A; Green Ranch SC-312; 3-year-olds & older)
  { code: "RR-O", name: "Ranch Riding", discipline: "Ranch Riding", division: "Open (horses 3+, SC-185.E.4)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "RR-GR", name: "Green Ranch Riding", discipline: "Ranch Riding", division: "Green (horse eligibility, SC-312)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "RR-AM", name: "Amateur Ranch Riding", discipline: "Ranch Riding", division: "Amateur", isYouth: false, isAmateur: true, isOpen: false },
  { code: "RR-Y", name: "Youth Ranch Riding", discipline: "Ranch Riding", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "RTRAIL-O", name: "Ranch Trail", discipline: "Ranch Trail", division: "Open (horses 3+)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "RRAIL-O", name: "Ranch Rail Pleasure", discipline: "Ranch Rail Pleasure", division: "Open (horses 3+)", isYouth: false, isAmateur: false, isOpen: true },
  // Cattle events (SC-190.A)
  { code: "WCH-O", name: "Working Cow Horse", discipline: "Working Cow Horse", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "CUT-O", name: "Cutting", discipline: "Cutting", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "PEN-O", name: "Team Penning", discipline: "Team Penning", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "SORT-O", name: "Ranch Sorting", discipline: "Ranch Sorting", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  // Speed events (SC-190.A)
  { code: "BARREL-O", name: "Barrel Racing", discipline: "Speed Events", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "BARREL-Y", name: "Youth Barrel Racing", discipline: "Speed Events", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  { code: "POLE-O", name: "Pole Bending", discipline: "Speed Events", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "POLE-Y", name: "Youth Pole Bending", discipline: "Speed Events", division: "Youth", isYouth: true, isAmateur: false, isOpen: false },
  // Over fences (SC-190.A; equitation over fences amateur-only per AM-095.B)
  { code: "WH-O", name: "Working Hunter", discipline: "Over Fences", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "HH-O", name: "Hunter Hack", discipline: "Over Fences", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "JMP-O", name: "Jumping", discipline: "Over Fences", division: "Open", isYouth: false, isAmateur: false, isOpen: true },
  { code: "EOF-AM", name: "Amateur Hunt Seat Equitation Over Fences", discipline: "Over Fences", division: "Amateur (AM-095.B)", isYouth: false, isAmateur: true, isOpen: false },
  // In-hand futurity-style classes (date windows, SC-190.A; excluded from Novice Amateur, AM-250.A)
  { code: "LL-O", name: "Yearling Longe Line", discipline: "Longe Line", division: "Open (after May 15 only, SC-190.A)", isYouth: false, isAmateur: false, isOpen: true },
  { code: "IHT-O", name: "Yearling In-Hand Trail", discipline: "In-Hand Trail", division: "Open (before May 15 only, SC-190.A)", isYouth: false, isAmateur: false, isOpen: true },
  // Participation events (no points)
  { code: "LEAD-Y", name: "Leadline", discipline: "Leadline", division: "Youth 3-8, handler 16+ (YP-105)", isYouth: true, isAmateur: false, isOpen: false, countsForPoints: false },
];

export async function createAphaStarterPackage(
  organizationId: string,
  year: number
): Promise<ActionResult> {
  const supabase = await createClient();

  let { data: assoc } = await supabase
    .from("associations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "APHA")
    .maybeSingle();

  if (!assoc) {
    const { data: created, error } = await supabase
      .from("associations")
      .insert({ organization_id: organizationId, name: "APHA" })
      .select("id")
      .maybeSingle();
    if (error || !created) {
      return { error: error?.message ?? "Could not create the APHA association." };
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
        "Starter package transcribed from the organization's own copy of the official APHA 2026 Rule Book. Class catalog follows the approved-events list (SC-190.A) and halter slate (SC-175.M) across APHA divisions; eligibility rules cite their rule numbers. APHA publishes class NAMES only — codes here are internal mnemonics; align with the APHA Performance Department's electronic-results format (SC-125.A) before publishing. Key operational data points: results postmarked within 10 calendar days of the last show day, $29/day late fee (SC-125.A); electronic results required, $79/judge special handling otherwise; $3 show processing fee per entry per judge (SC-125.B); show application per judge ≥90 days out ($39 online), under 30 days not approved (SC-090.C-D); point chart SC-060.A.1 (½ pt at 2 shown … 6-5-4-3-2-1 at 18+; not expressible as a flat placing schedule); placings through 7th mandatory (SC-155.A); all exhibitors AND owners need current APHA/AjPHA membership, cards inspected at the show (SC-160.A); SPB horses compete with Regular Registry as of 2025 (SC-325.A.1); Novice caps <75 revalued pts / <$2,500 per category (AM-205.A, YP-205.A); Green: first year or ≤25 pts and ≤$2,500 lifetime in the event (SC-246.D); results corrections accepted 1 year (SC-125.E). NOTE: the widely-cited >5% results error-rate policy is NOT in the 2026 rulebook — it is Performance Department practice, so it carries no rule citation here.",
    })
    .select("id")
    .maybeSingle();

  if (pkgError || !pkg) {
    if (pkgError?.message.includes("association_rule_packages_association_id_year_version_key")) {
      return { error: `An APHA ${year} v1 rule package already exists.` };
    }
    return { error: pkgError?.message ?? "Could not create the rule package." };
  }

  const { error: codesError } = await supabase.from("association_class_codes").insert(
    APHA_STARTER_CLASSES.map((c) => ({
      rule_package_id: pkg.id,
      code: c.code,
      name: c.name,
      discipline: c.discipline,
      division: c.division,
      is_youth: c.isYouth,
      is_amateur: c.isAmateur,
      is_open: c.isOpen,
      is_non_pro: false,
      counts_for_points: c.countsForPoints ?? true,
    }))
  );
  if (codesError) return { error: codesError.message };

  // Eligibility rules in the engine's vocabulary (rider.age, ownership).
  // Where APHA's rule is broader than the engine can check (immediate-family
  // ownership, age as of Jan 1, cards, novice point caps), the rule is a
  // WARNING with the citation so the office verifies by hand.
  const { error: rulesError } = await supabase.from("association_eligibility_rules").insert([
    {
      rule_package_id: pkg.id,
      rule_key: "apha_youth_age",
      applies_to: ["youth"],
      conditions: [{ field: "rider.age", operator: "less_than", value: "19" }],
      severity: "warning",
      message:
        "APHA youth exhibitors must be 18 & under as of January 1 (YP-010.A; the Jan 1 age holds all year). Married persons/domestic partnerships are ineligible regardless of age (YP-010.B). Verify the current AjPHA card (YP-005.A.5).",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "apha_amateur_age",
      applies_to: ["amateur"],
      conditions: [{ field: "rider.age", operator: "greater_than", value: "18" }],
      severity: "warning",
      message:
        "APHA amateurs must be no longer youth-eligible — 19+ as of January 1 (AM-010.A.1, AM-080.A.1) — hold a current Amateur card (AM-015.A), and satisfy the 36-month no-remuneration rule (AM-010.A.2).",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "apha_masters_age",
      applies_to: ["WP-MAS"],
      conditions: [{ field: "rider.age", operator: "greater_than", value: "44" }],
      severity: "warning",
      message:
        "Masters amateur classes are for amateurs aged 45 & over as of January 1 (AM-080.A.2.b).",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "apha_amateur_ownership",
      applies_to: ["amateur"],
      conditions: [{ field: "horse.ownedByRider", operator: "equals", value: "true" }],
      severity: "warning",
      message:
        "APHA amateur classes require the horse to be recorded to the amateur or immediate family at entry (AM-020.A) — the rider isn't a listed owner, so verify the family relationship or an APHA Show Lease (AM-020.A.1). Any partnership with a non-family member is ineligible (AM-020.A.2). Novice Amateur may enter without ownership but earns no points (AM-210.B).",
    },
    {
      rule_package_id: pkg.id,
      rule_key: "apha_youth_ownership",
      applies_to: ["youth"],
      conditions: [{ field: "horse.ownedByRider", operator: "equals", value: "true" }],
      severity: "warning",
      message:
        "Youth may enter without owning the horse, but APHA points/titles require ownership by the youth or immediate family (YP-015.A) or an APHA Show Lease (YP-015.A.2) — the rider isn't a listed owner, so verify before counting on points.",
    },
  ]);
  if (rulesError) return { error: rulesError.message };

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
